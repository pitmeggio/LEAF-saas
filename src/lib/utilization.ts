// LEAF OS Essential — utilization & customer-flow analytics.
//
// Pure aggregation over LineBooking. Three windows feed three views:
//   • Annual flow      — bookings per month for the whole season
//   • Seasonal trend   — bookings per week for the last 12 weeks
//   • Line × slot heatmap — how often each (line, day, slot) gets used
//
// The page renders these as charts + a deterministic AI-style narrative
// (no LLM call — we read the aggregates and write a concise human
// sentence on what changed and where the peak is).

import { prisma } from "@/lib/db";
import { seasonBounds, type Season } from "@/lib/season";

export type BookingKind = "internal" | "pay_and_train" | "external_club";

export function classifyBookingKind(b: {
  groupId: string | null;
  payAndTrainEnabled: boolean;
  bookerOrg: string | null;
  customerEmail: string | null;
}): BookingKind {
  if (b.groupId) return "internal";
  if (b.payAndTrainEnabled) return "pay_and_train";
  if (b.bookerOrg || b.customerEmail) return "external_club";
  return "internal"; // shouldn't happen, but keep totals consistent
}

export type MonthBucket = {
  month: string;  // "Aug 2026"
  monthIso: string; // "2026-08"
  internal: number;
  payAndTrain: number;
  externalClub: number;
  total: number;
  revenue: number;          // sum of publicPrice for P&T (only the sold ones)
};

export type WeekBucket = {
  weekStart: Date;
  weekLabel: string;        // "25 Aug"
  internal: number;
  payAndTrain: number;
  externalClub: number;
  total: number;
};

export type HeatCell = {
  dayIdx: number;          // 0=Mon..6=Sun
  hour: number;            // 8..20
  count: number;
};

export type LineRow = {
  lineId: string;
  slopeName: string;
  lineLabel: string;
  bookings: number;
  hours: number;
  utilization: number;     // fraction of the (lineSlotsPerWeek × weeks) capacity
};

export type CustomerRow = {
  email: string;
  name: string;
  bookings: number;
  spent: number;
  lastBookingAt: Date;
};

export type UtilizationReport = {
  season: Season;
  totals: {
    bookings: number;
    internal: number;
    payAndTrain: number;
    externalClub: number;
    payAndTrainRevenue: number;
    distinctPayAndTrainCustomers: number;
    distinctExternalClubs: number;
  };
  monthly: MonthBucket[];
  weekly: WeekBucket[];
  heatmap: HeatCell[];
  topLines: LineRow[];
  topCustomers: CustomerRow[];
  topClubs: { org: string; bookings: number }[];
  narrative: string;
};

const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function getUtilizationReport(academyId: string, season: Season, currencyCode: string): Promise<UtilizationReport> {
  const { start: seasonStart, end: seasonEnd } = seasonBounds(season);

  const [bookings, slopes] = await Promise.all([
    prisma.lineBooking.findMany({
      where: {
        academyId,
        startAt: { gte: seasonStart, lt: seasonEnd },
        status: { in: ["confirmed", "pending"] },
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        groupId: true,
        payAndTrainEnabled: true,
        bookerOrg: true,
        customerEmail: true,
        customerName: true,
        publicPrice: true,
        lineId: true,
        line: { select: { label: true, slope: { select: { name: true } } } },
      },
    }),
    prisma.trainingSlope.findMany({
      where: { academyId, active: true },
      include: { lines: true },
    }),
  ]);

  // ── Monthly buckets ──────────────────────────────────────────────────
  const monthMap = new Map<string, MonthBucket>();
  // Seed every month of the season so empty months still render on the chart.
  {
    const cursor = new Date(seasonStart);
    while (cursor < seasonEnd) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth();
      const monthIso = `${y}-${String(m + 1).padStart(2, "0")}`;
      monthMap.set(monthIso, {
        month: `${MONTH_LABEL[m]} ${y}`,
        monthIso,
        internal: 0,
        payAndTrain: 0,
        externalClub: 0,
        total: 0,
        revenue: 0,
      });
      cursor.setUTCMonth(m + 1);
    }
  }

  // ── Weekly buckets (last 12 weeks ending now) ────────────────────────
  const now = new Date();
  const weeklyStart = new Date(now);
  weeklyStart.setUTCHours(0, 0, 0, 0);
  weeklyStart.setUTCDate(weeklyStart.getUTCDate() - (weeklyStart.getUTCDay() === 0 ? 6 : weeklyStart.getUTCDay() - 1));
  weeklyStart.setUTCDate(weeklyStart.getUTCDate() - 7 * 11); // 12 weeks total
  const weekMap = new Map<string, WeekBucket>();
  for (let i = 0; i < 12; i++) {
    const ws = new Date(weeklyStart);
    ws.setUTCDate(ws.getUTCDate() + i * 7);
    const wsIso = ws.toISOString().slice(0, 10);
    weekMap.set(wsIso, {
      weekStart: ws,
      weekLabel: ws.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }),
      internal: 0,
      payAndTrain: 0,
      externalClub: 0,
      total: 0,
    });
  }

  // ── Heatmap (day × hour) ─────────────────────────────────────────────
  const heatMap = new Map<string, HeatCell>();

  // ── Per-line + per-customer + per-club aggregates ────────────────────
  const lineAgg = new Map<string, LineRow>();
  for (const slope of slopes) {
    for (const l of slope.lines) {
      lineAgg.set(l.id, { lineId: l.id, slopeName: slope.name, lineLabel: l.label, bookings: 0, hours: 0, utilization: 0 });
    }
  }
  const customerAgg = new Map<string, CustomerRow>();
  const clubAgg = new Map<string, number>();
  const ptCustomers = new Set<string>();
  const externalClubs = new Set<string>();

  let internalCount = 0;
  let payAndTrainCount = 0;
  let externalCount = 0;
  let payAndTrainRevenue = 0;

  for (const b of bookings) {
    const kind = classifyBookingKind(b);
    const month = b.startAt.getUTCMonth();
    const year = b.startAt.getUTCFullYear();
    const monthIso = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthBucket = monthMap.get(monthIso);
    if (monthBucket) {
      monthBucket.total++;
      if (kind === "internal") monthBucket.internal++;
      else if (kind === "pay_and_train") {
        monthBucket.payAndTrain++;
        monthBucket.revenue += b.publicPrice ?? 0;
      } else monthBucket.externalClub++;
    }

    // Week bucket — only counts if within the 12-week window.
    if (b.startAt >= weeklyStart && b.startAt < new Date(weeklyStart.getTime() + 12 * 7 * 86400_000)) {
      const wsForBooking = new Date(b.startAt);
      wsForBooking.setUTCHours(0, 0, 0, 0);
      const day = wsForBooking.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      wsForBooking.setUTCDate(wsForBooking.getUTCDate() + diff);
      const wsIso = wsForBooking.toISOString().slice(0, 10);
      const wb = weekMap.get(wsIso);
      if (wb) {
        wb.total++;
        if (kind === "internal") wb.internal++;
        else if (kind === "pay_and_train") wb.payAndTrain++;
        else wb.externalClub++;
      }
    }

    // Heatmap cell.
    const dayIdx = b.startAt.getUTCDay() === 0 ? 6 : b.startAt.getUTCDay() - 1;
    const hour = b.startAt.getUTCHours();
    const cellKey = `${dayIdx}|${hour}`;
    const cell = heatMap.get(cellKey);
    if (cell) cell.count++;
    else heatMap.set(cellKey, { dayIdx, hour, count: 1 });

    // Per-line.
    const lineRow = lineAgg.get(b.lineId);
    if (lineRow) {
      lineRow.bookings++;
      lineRow.hours += Math.max(0, (b.endAt.getTime() - b.startAt.getTime()) / 3_600_000);
    }

    // Per-customer (P&T).
    if (kind === "pay_and_train" && b.customerEmail) {
      ptCustomers.add(b.customerEmail.toLowerCase());
      const c = customerAgg.get(b.customerEmail.toLowerCase()) ?? {
        email: b.customerEmail,
        name: b.customerName ?? b.customerEmail,
        bookings: 0,
        spent: 0,
        lastBookingAt: b.startAt,
      };
      c.bookings++;
      c.spent += b.publicPrice ?? 0;
      if (b.startAt > c.lastBookingAt) c.lastBookingAt = b.startAt;
      customerAgg.set(b.customerEmail.toLowerCase(), c);
    }

    // Per-club (external).
    if (kind === "external_club" && b.bookerOrg) {
      externalClubs.add(b.bookerOrg.toLowerCase());
      clubAgg.set(b.bookerOrg, (clubAgg.get(b.bookerOrg) ?? 0) + 1);
    }

    if (kind === "internal") internalCount++;
    else if (kind === "pay_and_train") {
      payAndTrainCount++;
      payAndTrainRevenue += b.publicPrice ?? 0;
    } else externalCount++;
  }

  // Utilization: each line has 6 slots/day × 7 days = 42 slots/week × weeks
  // since season start. We treat the season-to-date window so empty future
  // weeks don't crater the percentage.
  const SLOTS_PER_LINE_PER_WEEK = 42;
  const weeksElapsed = Math.max(1, Math.floor((Math.min(now.getTime(), seasonEnd.getTime()) - seasonStart.getTime()) / (7 * 86400_000)));
  for (const row of lineAgg.values()) {
    const capacity = SLOTS_PER_LINE_PER_WEEK * weeksElapsed;
    row.utilization = capacity > 0 ? row.bookings / capacity : 0;
  }

  // ── Narrative ────────────────────────────────────────────────────────
  // Deterministic plain-English summary. No LLM — fast, audit-safe.
  const topLine = [...lineAgg.values()].sort((a, b) => b.bookings - a.bookings)[0];
  const topClub = [...clubAgg.entries()].sort((a, b) => b[1] - a[1])[0];
  const recentWeek = [...weekMap.values()].slice(-1)[0];
  const priorWeek = [...weekMap.values()].slice(-2, -1)[0];
  const weekDelta = recentWeek && priorWeek ? recentWeek.total - priorWeek.total : 0;
  const weekDeltaPct = priorWeek && priorWeek.total > 0 ? Math.round((weekDelta / priorWeek.total) * 100) : 0;
  const narrativeParts: string[] = [];
  narrativeParts.push(`${bookings.length} bookings this season — ${internalCount} team, ${payAndTrainCount} Pay-and-Train, ${externalCount} visiting clubs.`);
  if (topLine && topLine.bookings > 0) {
    narrativeParts.push(`${topLine.slopeName} Line ${topLine.lineLabel} is your busiest line (${topLine.bookings} bookings, ${Math.round(topLine.utilization * 100)}% utilized).`);
  }
  if (payAndTrainRevenue > 0) {
    narrativeParts.push(`Pay-and-Train brought in ${currencyCode} ${payAndTrainRevenue.toLocaleString("en-US")} so far this season.`);
  }
  if (topClub) {
    narrativeParts.push(`${topClub[0]} is your top visiting club (${topClub[1]} line bookings).`);
  }
  if (recentWeek && priorWeek && priorWeek.total > 0) {
    const trendWord = weekDelta > 0 ? "up" : weekDelta < 0 ? "down" : "flat";
    narrativeParts.push(`This week is ${trendWord} ${Math.abs(weekDeltaPct)}% vs last week.`);
  }

  const narrative = narrativeParts.join(" ");

  return {
    season,
    totals: {
      bookings: bookings.length,
      internal: internalCount,
      payAndTrain: payAndTrainCount,
      externalClub: externalCount,
      payAndTrainRevenue,
      distinctPayAndTrainCustomers: ptCustomers.size,
      distinctExternalClubs: externalClubs.size,
    },
    monthly: [...monthMap.values()],
    weekly: [...weekMap.values()],
    heatmap: [...heatMap.values()],
    topLines: [...lineAgg.values()].sort((a, b) => b.bookings - a.bookings).slice(0, 8),
    topCustomers: [...customerAgg.values()].sort((a, b) => b.bookings - a.bookings).slice(0, 8),
    topClubs: [...clubAgg.entries()].map(([org, bookings]) => ({ org, bookings })).sort((a, b) => b.bookings - a.bookings).slice(0, 6),
    narrative,
  };
}

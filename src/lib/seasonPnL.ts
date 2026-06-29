import { prisma } from "@/lib/db";

// Season P&L — "rendiconto economico della stagione". Aggregates every money
// stream LEAF already records into one statement: revenue (fees, camps, court
// bookings, other) minus costs (staff, approved expenses), monthly + total.
//
// Amounts are major units (EUR) across the schema. Camp/court lines are tennis
// primitives — they read 0 for ski tenants, so this is sport-agnostic.

export type PnLLine = { key: string; label: string; collected: number; pending: number };
export type PnLMonth = { label: string; revenue: number; cost: number };

export type SeasonPnL = {
  season: string;
  currency: string;
  windowStart: string;
  windowEnd: string;
  revenue: { lines: PnLLine[]; collected: number; pending: number };
  cost: { lines: PnLLine[]; total: number };
  net: number;
  months: PnLMonth[];
  hasData: boolean;
};

function seasonYear(season: string): number {
  const m = season.match(/(\d{4})/);
  return m ? Number(m[1]) : new Date().getUTCFullYear();
}

// Ski runs Sep→Aug; tennis (and default) over the calendar year of the season.
function seasonWindow(season: string, sport: string): { start: Date; end: Date; months: { label: string; start: Date; end: Date }[] } {
  const y = seasonYear(season);
  const startMonth = sport === "ski" ? 8 /* Sep */ : 0 /* Jan */;
  const start = new Date(Date.UTC(y, startMonth, 1));
  const months: { label: string; start: Date; end: Date }[] = [];
  const MON = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  for (let i = 0; i < 12; i++) {
    const ms = new Date(Date.UTC(y, startMonth + i, 1));
    const me = new Date(Date.UTC(y, startMonth + i + 1, 1));
    months.push({ label: MON[ms.getUTCMonth()], start: ms, end: me });
  }
  const end = new Date(Date.UTC(y, startMonth + 12, 1));
  return { start, end, months };
}

export async function getSeasonPnL(academyId: string, season: string, sport: string): Promise<SeasonPnL> {
  const { start, end, months } = seasonWindow(season, sport);
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } });
  const currency = academy?.currency ?? "EUR";

  const [payments, campRegs, courtBookings, otherRev, coaches, expenses] = await Promise.all([
    prisma.payment.findMany({ where: { academyId }, select: { amount: true, paidAmount: true, status: true, paidDate: true, dueDate: true } }),
    prisma.tennisCampRegistration.findMany({
      where: { camp: { academyId } },
      select: { paidAmount: true, status: true, createdAt: true, camp: { select: { price: true } } },
    }),
    prisma.courtBooking.findMany({ where: { academyId }, select: { paidAmount: true, startAt: true } }),
    prisma.revenue.findMany({ where: { academyId }, select: { amount: true, status: true, receivedDate: true, createdAt: true } }),
    prisma.coach.findMany({ where: { academyId, active: true }, select: { cost: true } }),
    prisma.expense.findMany({ where: { academyId }, select: { amount: true, status: true, expenseDate: true, createdAt: true } }),
  ]);

  const inWin = (d: Date | null | undefined) => !!d && d >= start && d < end;
  const monthIdx = (d: Date) => months.findIndex((m) => d >= m.start && d < m.end);

  const monthRev = new Array(12).fill(0);
  const monthCost = new Array(12).fill(0);

  // ── Revenue ──
  let feesCollected = 0, feesPending = 0;
  for (const p of payments) {
    if (inWin(p.paidDate) && p.paidAmount > 0) { feesCollected += p.paidAmount; const i = monthIdx(p.paidDate!); if (i >= 0) monthRev[i] += p.paidAmount; }
    const outstanding = Math.max(0, p.amount - p.paidAmount);
    if (outstanding > 0 && inWin(p.dueDate)) feesPending += outstanding;
  }

  let campsCollected = 0, campsPending = 0;
  for (const r of campRegs) {
    if (r.status === "cancelled") continue;
    if (inWin(r.createdAt)) {
      campsCollected += r.paidAmount;
      const i = monthIdx(r.createdAt); if (i >= 0) monthRev[i] += r.paidAmount;
      const bal = Math.max(0, (r.camp?.price ?? 0) - r.paidAmount);
      if (r.status === "confirmed") campsPending += bal;
    }
  }

  let courtsCollected = 0;
  for (const b of courtBookings) {
    if (inWin(b.startAt) && b.paidAmount > 0) { courtsCollected += b.paidAmount; const i = monthIdx(b.startAt); if (i >= 0) monthRev[i] += b.paidAmount; }
  }

  let otherCollected = 0, otherPending = 0;
  for (const r of otherRev) {
    const d = r.receivedDate ?? r.createdAt;
    if (r.status === "received" && inWin(d)) { otherCollected += r.amount; const i = monthIdx(d); if (i >= 0) monthRev[i] += r.amount; }
    else if (r.status === "pledged" && inWin(d)) otherPending += r.amount;
  }

  // ── Cost ──
  const staffSeason = coaches.reduce((s, c) => s + (c.cost ?? 0), 0);
  // Spread the season staff cost evenly across the 12 months for the chart.
  const staffPerMonth = staffSeason / 12;
  for (let i = 0; i < 12; i++) monthCost[i] += staffPerMonth;

  let expensesTotal = 0;
  for (const e of expenses) {
    if (!["approved", "reimbursed"].includes(e.status)) continue;
    const d = e.expenseDate ?? e.createdAt;
    if (inWin(d)) { expensesTotal += e.amount; const i = monthIdx(d); if (i >= 0) monthCost[i] += e.amount; }
  }

  const revenueLines: PnLLine[] = [
    { key: "fees", label: "Rette / iscrizioni", collected: feesCollected, pending: feesPending },
    { key: "camps", label: "Camp", collected: campsCollected, pending: campsPending },
    { key: "courts", label: "Campi (prenotazioni)", collected: courtsCollected, pending: 0 },
    { key: "other", label: "Sponsor / altri ricavi", collected: otherCollected, pending: otherPending },
  ].filter((l) => l.collected > 0 || l.pending > 0);

  const costLines: PnLLine[] = [
    { key: "staff", label: "Costo staff (stagione)", collected: staffSeason, pending: 0 },
    { key: "expenses", label: "Spese approvate", collected: expensesTotal, pending: 0 },
  ].filter((l) => l.collected > 0);

  const revenueCollected = feesCollected + campsCollected + courtsCollected + otherCollected;
  const revenuePending = feesPending + campsPending + otherPending;
  const costTotal = staffSeason + expensesTotal;

  return {
    season,
    currency,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    revenue: { lines: revenueLines, collected: revenueCollected, pending: revenuePending },
    cost: { lines: costLines, total: costTotal },
    net: revenueCollected - costTotal,
    months: months.map((m, i) => ({ label: m.label, revenue: Math.round(monthRev[i]), cost: Math.round(monthCost[i]) })),
    hasData: revenueCollected > 0 || revenuePending > 0 || costTotal > 0,
  };
}

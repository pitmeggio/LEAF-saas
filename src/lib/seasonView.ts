// Cross-athlete season view aggregation. THE feature Max doesn't have in
// Excel: every athlete's calendar overlaid as horizontal swim-lanes on one
// shared time axis, so the head coach sees load distribution, weekend
// clashes (Max can't be in 3 places at once) and gap weeks at a glance.

import { prisma } from "@/lib/db";

export type LaneEntry = {
  id: string;
  monthIdx: number;          // 0..12 fractional
  weekStart: Date;
  columnKey: string;
  label: string;             // tournament name OR free text
  location: string | null;
  status: string;
  trainingPhase: string | null;
};

export type AthleteLane = {
  athleteId: string;
  displayName: string;
  age: number;
  total: number;
  byCategory: Record<string, number>;
  topCategory: string | null;
  entries: LaneEntry[];
};

export type WeekendClash = {
  weekStart: Date;
  monthIdx: number;
  athleteIds: string[];      // 2+ athletes with tournaments that week
  athleteNames: string[];
  count: number;
};

export type SeasonView = {
  season: string;
  academy: { name: string; logoColor: string };
  lanes: AthleteLane[];
  clashes: WeekendClash[];
  // Total entries per week — fed into the "load" sparkline above the lanes.
  weekLoad: { weekIso: string; monthIdx: number; total: number }[];
  narrative: string;
};

export async function getSeasonView(academyId: string): Promise<SeasonView | null> {
  const academy = await prisma.academy.findUnique({
    where: { id: academyId },
    select: { name: true, logoColor: true },
  });
  if (!academy) return null;

  const plans = await prisma.tennisSeasonPlan.findMany({
    where: { academyId },
    include: {
      athlete: { select: { id: true, firstName: true, lastName: true, dob: true } },
      entries: { include: { tournament: true }, orderBy: { weekStart: "asc" } },
    },
    orderBy: { season: "desc" },
  });
  if (plans.length === 0) {
    return {
      season: String(new Date().getFullYear()),
      academy,
      lanes: [],
      clashes: [],
      weekLoad: [],
      narrative: "No season plans yet — import a tournament calendar to start.",
    };
  }

  const season = plans[0].season;
  const lanes: AthleteLane[] = plans.map((p) => {
    const ents: LaneEntry[] = p.entries.map((e) => ({
      id: e.id,
      monthIdx: e.weekStart.getUTCMonth() + (e.weekStart.getUTCDate() - 1) / 31,
      weekStart: e.weekStart,
      columnKey: e.columnKey,
      label: e.tournament?.name ?? e.freeText ?? "—",
      location: e.tournament?.location ?? null,
      status: e.status,
      trainingPhase: e.trainingPhase,
    }));
    const byCategory: Record<string, number> = {};
    for (const e of ents) byCategory[e.columnKey] = (byCategory[e.columnKey] ?? 0) + 1;
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const age = Math.floor((Date.now() - p.athlete.dob.getTime()) / (365.25 * 86400_000));
    return {
      athleteId: p.athleteId,
      displayName: p.athlete.firstName,
      age,
      total: ents.length,
      byCategory,
      topCategory,
      entries: ents,
    };
  });

  // Weekend clashes: per ISO week, which lanes have ≥1 entry?
  const weekMap = new Map<string, { weekStart: Date; monthIdx: number; athleteIds: Set<string>; athleteNames: Set<string>; total: number }>();
  for (const lane of lanes) {
    for (const e of lane.entries) {
      const key = isoWeek(e.weekStart);
      const cell = weekMap.get(key) ?? {
        weekStart: e.weekStart,
        monthIdx: e.monthIdx,
        athleteIds: new Set<string>(),
        athleteNames: new Set<string>(),
        total: 0,
      };
      cell.athleteIds.add(lane.athleteId);
      cell.athleteNames.add(lane.displayName);
      cell.total++;
      weekMap.set(key, cell);
    }
  }
  const clashes: WeekendClash[] = [];
  const weekLoad: { weekIso: string; monthIdx: number; total: number }[] = [];
  for (const [iso, cell] of weekMap) {
    weekLoad.push({ weekIso: iso, monthIdx: cell.monthIdx, total: cell.total });
    if (cell.athleteIds.size >= 3) {
      clashes.push({
        weekStart: cell.weekStart,
        monthIdx: cell.monthIdx,
        athleteIds: [...cell.athleteIds],
        athleteNames: [...cell.athleteNames],
        count: cell.athleteIds.size,
      });
    }
  }
  clashes.sort((a, b) => b.count - a.count);
  weekLoad.sort((a, b) => a.monthIdx - b.monthIdx);

  // Coach-language narrative — load summary + clash callout + busiest athlete.
  const heaviest = [...lanes].sort((a, b) => b.total - a.total)[0];
  const lightest = [...lanes].sort((a, b) => a.total - b.total)[0];
  const totalEntries = lanes.reduce((s, l) => s + l.total, 0);
  const parts: string[] = [];
  parts.push(`${lanes.length} atleti · ${totalEntries} eventi pianificati nella stagione.`);
  if (heaviest && lightest && heaviest.total > lightest.total + 5) {
    parts.push(`Carico squilibrato: ${heaviest.displayName} ${heaviest.total} eventi vs ${lightest.displayName} ${lightest.total}.`);
  }
  if (clashes.length > 0) {
    const top = clashes[0];
    parts.push(`${clashes.length} settimane con ${clashes[0].count}+ atleti in trasferta simultanea. Più carica: settimana del ${top.weekStart.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} con ${top.athleteNames.slice(0, 3).join(", ")}${top.athleteNames.length > 3 ? `, +${top.athleteNames.length - 3}` : ""}.`);
  }
  const narrative = parts.join(" ");

  return {
    season,
    academy,
    lanes,
    clashes,
    weekLoad,
    narrative,
  };
}

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

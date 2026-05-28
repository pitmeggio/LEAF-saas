// Server-side aggregation for the Athlete Canvas / Season Arc.
// Pure read; no LLM call. Builds the shape the cinematic UI consumes.

import { prisma } from "@/lib/db";

export type CanvasEntry = {
  id: string;
  weekStart: Date;
  weekIso: string;          // "2026-W08"
  monthIdx: number;         // 0-11
  trainingPhase: string | null;
  columnKey: string;
  tournamentId: string | null;
  tournamentName: string | null;
  location: string | null;
  category: string | null;
  startDate: Date | null;
  endDate: Date | null;
  freeText: string | null;
  status: string;
  pointsPotential: number | null;
};

export type CanvasPhaseBand = {
  startMonth: number;       // 0..11 (fractional)
  endMonth: number;         // 0..11 (fractional)
  phase: string;            // "Preparazione Invernale" | "TEST" | "Consolidamento" | "Mantenimento" | "Recovery"
};

export type AthleteCanvas = {
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    nationality: string;
    gender: string | null;
    dob: Date;
    age: number;
    sport: string;
  };
  academy: { name: string; logoColor: string; slug: string };
  season: string;
  columns: string[];
  entries: CanvasEntry[];
  phaseBands: CanvasPhaseBand[];
  upcoming: CanvasEntry[];     // next 3 tournament entries (status=planned/registered)
  totals: {
    totalEntries: number;
    byCategory: Record<string, number>;
    byPhase: Record<string, number>;
    upcomingCount: number;
    eliteCount: number;       // ITF + OPEN combined
  };
  narrative: string;
};

const PHASE_ORDER = ["Preparazione Invernale", "TEST", "Consolidamento", "Mantenimento", "Recovery"];

export async function getAthleteCanvas(athleteId: string): Promise<AthleteCanvas | null> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, firstName: true, lastName: true, nationality: true, gender: true, dob: true, sport: true },
  });
  if (!athlete) return null;

  // Plan + entries + tournament catalogue join.
  const plan = await prisma.tennisSeasonPlan.findFirst({
    where: { athleteId },
    orderBy: { season: "desc" },
    include: {
      academy: { select: { name: true, logoColor: true, slug: true } },
      entries: {
        include: { tournament: true },
        orderBy: { weekStart: "asc" },
      },
    },
  });
  if (!plan) return null;

  const cols = Array.isArray(plan.columns) ? (plan.columns as string[]) : [];
  const entries: CanvasEntry[] = plan.entries.map((e) => ({
    id: e.id,
    weekStart: e.weekStart,
    weekIso: isoWeek(e.weekStart),
    monthIdx: e.weekStart.getUTCMonth(),
    trainingPhase: e.trainingPhase,
    columnKey: e.columnKey,
    tournamentId: e.tournamentId,
    tournamentName: e.tournament?.name ?? null,
    location: e.tournament?.location ?? null,
    category: e.tournament?.category ?? e.columnKey,
    startDate: e.tournament?.startDate ?? null,
    endDate: e.tournament?.endDate ?? null,
    freeText: e.freeText,
    status: e.status,
    pointsPotential: e.tournament?.pointsPotential ?? null,
  }));

  // Compress consecutive same-phase weeks into bands for the Arc's
  // background ribbon. Bands are in "month-units" so the SVG can map them
  // straight onto a 12-month x-axis.
  const phaseBands = buildPhaseBands(entries);

  const now = new Date();
  const upcoming = entries
    .filter((e) => e.tournamentName && e.weekStart >= now && ["planned", "registered", "confirmed"].includes(e.status))
    .slice(0, 3);

  const byCategory: Record<string, number> = {};
  const byPhase: Record<string, number> = {};
  for (const e of entries) {
    byCategory[e.columnKey] = (byCategory[e.columnKey] ?? 0) + 1;
    if (e.trainingPhase) byPhase[e.trainingPhase] = (byPhase[e.trainingPhase] ?? 0) + 1;
  }

  const eliteCount = (byCategory.ITF ?? 0) + (byCategory.OPEN ?? 0);

  const age = Math.floor((Date.now() - athlete.dob.getTime()) / (365.25 * 86400_000));

  const narrative = buildNarrative({
    name: athlete.firstName,
    season: plan.season,
    totalEntries: entries.length,
    eliteCount,
    byCategory,
    upcoming,
  });

  return {
    athlete: {
      id: athlete.id,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      nationality: athlete.nationality,
      gender: athlete.gender,
      dob: athlete.dob,
      age,
      sport: athlete.sport,
    },
    academy: plan.academy,
    season: plan.season,
    columns: cols,
    entries,
    phaseBands,
    upcoming,
    totals: {
      totalEntries: entries.length,
      byCategory,
      byPhase,
      upcomingCount: upcoming.length,
      eliteCount,
    },
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

function buildPhaseBands(entries: CanvasEntry[]): CanvasPhaseBand[] {
  // Walk weeks chronologically, group runs of same phase. Map each week to
  // a fractional "month index" so the SVG x-axis (0-12) plots correctly.
  type Sample = { monthFrac: number; phase: string | null };
  const samples: Sample[] = [];
  for (const e of entries) {
    const m = e.weekStart.getUTCMonth();
    const dayOfMonth = e.weekStart.getUTCDate();
    const daysInMonth = new Date(Date.UTC(e.weekStart.getUTCFullYear(), m + 1, 0)).getUTCDate();
    const frac = m + (dayOfMonth - 1) / daysInMonth;
    samples.push({ monthFrac: frac, phase: e.trainingPhase });
  }
  // Deduplicate by week + sort.
  const dedupe = new Map<number, string | null>();
  for (const s of samples) {
    const k = Math.round(s.monthFrac * 52);
    if (!dedupe.has(k) && s.phase) dedupe.set(k, s.phase);
  }
  const sorted = [...dedupe.entries()].sort((a, b) => a[0] - b[0]);
  const bands: CanvasPhaseBand[] = [];
  for (const [weekKey, phase] of sorted) {
    if (!phase) continue;
    const monthFrac = weekKey / 52 * 12;
    if (bands.length > 0 && bands[bands.length - 1].phase === phase && monthFrac - bands[bands.length - 1].endMonth < 0.6) {
      bands[bands.length - 1].endMonth = Math.min(12, monthFrac + 0.25);
    } else {
      bands.push({ startMonth: Math.max(0, monthFrac - 0.1), endMonth: Math.min(12, monthFrac + 0.3), phase });
    }
  }
  return bands;
}

function buildNarrative(args: {
  name: string;
  season: string;
  totalEntries: number;
  eliteCount: number;
  byCategory: Record<string, number>;
  upcoming: CanvasEntry[];
}): string {
  const parts: string[] = [];
  parts.push(`${args.name}'s ${args.season} season — ${args.totalEntries} planned entries across ${Object.keys(args.byCategory).length} tournament tiers.`);
  if (args.eliteCount > 0) {
    parts.push(`${args.eliteCount} elite events (ITF + OPEN) anchor the year.`);
  }
  if (args.upcoming.length > 0) {
    const next = args.upcoming[0];
    parts.push(`Next up: ${next.tournamentName ?? next.freeText ?? "TBD"}${next.location ? ` in ${next.location}` : ""}.`);
  } else {
    parts.push(`No tournaments scheduled in the next few weeks — pure training block.`);
  }
  return parts.join(" ");
}

// Sort helper exposed for the AI co-pilot's insight engine.
export function phaseRank(p: string | null): number {
  if (!p) return 99;
  const idx = PHASE_ORDER.indexOf(p);
  return idx === -1 ? 50 : idx;
}

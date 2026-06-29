import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";

const ACTIVE = ["active", "accepted", "injured", "paused"];

// Academy roster used to match imported timing rows to real athletes.
export async function getAcademyRoster() {
  const academyId = await requireAcademyId();
  const enr = await prisma.enrollment.findMany({
    where: { academyId, status: { in: ACTIVE } },
    select: { athlete: { select: { id: true, firstName: true, lastName: true } } },
  });
  const map = new Map<string, { id: string; firstName: string; lastName: string }>();
  for (const e of enr) map.set(e.athlete.id, e.athlete);
  return [...map.values()].sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
}

export type SessionRun = {
  id: string; athleteId: string; athleteName: string; bib: string | null;
  runNumber: number | null; finishMs: number | null; splitsMs: number[]; status: string | null;
};
export type TimingSession = {
  batchId: string; date: Date; kind: string; discipline: string | null;
  location: string | null; sessionLabel: string | null; source: string; runs: SessionRun[];
};

// Recent imported sessions, grouped by batch (one uploaded file).
export async function getRecentTimingSessions(take = 12): Promise<TimingSession[]> {
  const academyId = await requireAcademyId();
  const rows = await prisma.timingResult.findMany({
    where: { academyId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 1500,
    include: { athlete: { select: { firstName: true, lastName: true } } },
  });
  const groups = new Map<string, TimingSession>();
  for (const r of rows) {
    let g = groups.get(r.batchId);
    if (!g) {
      g = { batchId: r.batchId, date: r.date, kind: r.kind, discipline: r.discipline, location: r.location, sessionLabel: r.sessionLabel, source: r.source, runs: [] };
      groups.set(r.batchId, g);
    }
    g.runs.push({
      id: r.id, athleteId: r.athleteId, athleteName: `${r.athlete.firstName} ${r.athlete.lastName}`,
      bib: r.bib, runNumber: r.runNumber, finishMs: r.finishMs, splitsMs: r.splitsMs, status: r.status,
    });
  }
  return [...groups.values()].slice(0, take);
}

// All runs for one athlete (their record), newest first.
export async function getAthleteTimingRuns(athleteId: string, take = 40) {
  const academyId = await requireAcademyId();
  return prisma.timingResult.findMany({
    where: { academyId, athleteId },
    orderBy: [{ date: "desc" }, { runNumber: "asc" }],
    take,
  });
}

// ── Athlete-scoped (the APP) ─────────────────────────────────────────────────
// The athlete's own timed sessions (one entry per imported session), newest
// first. Scoped by athleteId — no academy lookup needed.
export async function getAthleteSessions(athleteId: string, take = 12) {
  const rows = await prisma.timingResult.findMany({
    where: { athleteId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 400,
    select: { batchId: true, date: true, kind: true, discipline: true, location: true, sessionLabel: true, finishMs: true },
  });
  const map = new Map<string, { batchId: string; date: Date; kind: string; discipline: string | null; location: string | null; sessionLabel: string | null; bestMs: number | null; runs: number }>();
  for (const r of rows) {
    let g = map.get(r.batchId);
    if (!g) { g = { batchId: r.batchId, date: r.date, kind: r.kind, discipline: r.discipline, location: r.location, sessionLabel: r.sessionLabel, bestMs: null, runs: 0 }; map.set(r.batchId, g); }
    g.runs++;
    if (r.finishMs != null && (g.bestMs == null || r.finishMs < g.bestMs)) g.bestMs = r.finishMs;
  }
  return [...map.values()].slice(0, take);
}

// One session's runs, but ONLY if this athlete participated (privacy). The
// academy is derived from the athlete's own row — never trusts a param.
export async function getSessionForAthlete(batchId: string, athleteId: string) {
  const mine = await prisma.timingResult.findFirst({ where: { batchId, athleteId }, select: { academyId: true } });
  if (!mine) return null;
  const rows = await prisma.timingResult.findMany({
    where: { batchId, academyId: mine.academyId },
    include: { athlete: { select: { firstName: true, lastName: true } } },
    orderBy: [{ runNumber: "asc" }],
  });
  if (rows.length === 0) return null;
  const first = rows[0];
  return {
    batchId, date: first.date, kind: first.kind, discipline: first.discipline, location: first.location, sessionLabel: first.sessionLabel,
    runs: rows.map((r) => ({
      id: r.id, athleteId: r.athleteId, athleteName: `${r.athlete.firstName} ${r.athlete.lastName}`,
      bib: r.bib, runNumber: r.runNumber, finishMs: r.finishMs, splitsMs: r.splitsMs, status: r.status,
    })),
  };
}

// All runs of one session — drives the leaderboard + sector analysis (OS).
export async function getSessionLeaderboard(batchId: string) {
  const academyId = await requireAcademyId();
  const rows = await prisma.timingResult.findMany({
    where: { academyId, batchId },
    include: { athlete: { select: { firstName: true, lastName: true } } },
    orderBy: [{ runNumber: "asc" }],
  });
  if (rows.length === 0) return null;
  const first = rows[0];
  return {
    batchId,
    date: first.date,
    kind: first.kind,
    discipline: first.discipline,
    location: first.location,
    sessionLabel: first.sessionLabel,
    runs: rows.map((r) => ({
      id: r.id, athleteId: r.athleteId, athleteName: `${r.athlete.firstName} ${r.athlete.lastName}`,
      bib: r.bib, runNumber: r.runNumber, finishMs: r.finishMs, splitsMs: r.splitsMs, status: r.status,
    })),
  };
}

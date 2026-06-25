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

export type TimingBatch = {
  batchId: string;
  date: Date;
  kind: string;
  discipline: string | null;
  location: string | null;
  source: string;
  count: number;
  results: {
    id: string; athleteId: string; athleteName: string; bib: string | null;
    run1Ms: number | null; run2Ms: number | null; totalMs: number | null; rank: number | null;
  }[];
};

// Recent imported sessions, grouped by their import batch (one uploaded file).
export async function getRecentTimingBatches(take = 12): Promise<TimingBatch[]> {
  const academyId = await requireAcademyId();
  const rows = await prisma.timingResult.findMany({
    where: { academyId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 600,
    include: { athlete: { select: { firstName: true, lastName: true } } },
  });
  const groups = new Map<string, TimingBatch>();
  for (const r of rows) {
    const key = r.batchId ?? `${r.date.toISOString().slice(0, 10)}|${r.discipline ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { batchId: key, date: r.date, kind: r.kind, discipline: r.discipline, location: r.location, source: r.source, count: 0, results: [] };
      groups.set(key, g);
    }
    g.count++;
    g.results.push({
      id: r.id, athleteId: r.athleteId, athleteName: `${r.athlete.firstName} ${r.athlete.lastName}`,
      bib: r.bib, run1Ms: r.run1Ms, run2Ms: r.run2Ms, totalMs: r.totalMs, rank: r.rank,
    });
  }
  // Sort each batch by rank then total time.
  for (const g of groups.values()) {
    g.results.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || (a.totalMs ?? 9e9) - (b.totalMs ?? 9e9));
  }
  return [...groups.values()].slice(0, take);
}

// All timing results for one athlete (their performance record), newest first.
export async function getAthleteTimingResults(athleteId: string, take = 20) {
  const academyId = await requireAcademyId();
  return prisma.timingResult.findMany({
    where: { academyId, athleteId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
  });
}

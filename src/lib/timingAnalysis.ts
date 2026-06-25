// Pure helpers for turning timing runs into a leaderboard and a "where did you
// lose time" sector analysis. Reused by the OS (coach) and the athlete app.

export type RunLike = { splitsMs: number[]; finishMs: number | null };

// Sector (split-to-split) durations from CUMULATIVE splits + finish.
// e.g. splits [12100, 28400], finish 45320 → sectors [12100, 16300, 16920].
export function sectorTimes(splitsMs: number[], finishMs: number | null | undefined): number[] {
  const points = [...(splitsMs ?? [])];
  if (finishMs != null) points.push(finishMs);
  const out: number[] = [];
  let prev = 0;
  for (const p of points) { out.push(p - prev); prev = p; }
  return out;
}

// Best run per athlete (lowest finish time), ranked fastest first.
export function bestPerAthlete<T extends { athleteId: string; finishMs: number | null }>(runs: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of runs) {
    if (r.finishMs == null) continue;
    const cur = best.get(r.athleteId);
    if (!cur || (cur.finishMs ?? Infinity) > r.finishMs) best.set(r.athleteId, r);
  }
  return [...best.values()].sort((a, b) => (a.finishMs ?? Infinity) - (b.finishMs ?? Infinity));
}

export type SectorLoss = { sector: number; lossMs: number; yourMs: number; bestMs: number };

// Compare one run's sector times against the field's BEST per sector — where
// did this athlete lose the most? `worst` is the sector with the biggest gap.
export function sectorLoss(myRun: RunLike, fieldRuns: RunLike[]): { sectors: SectorLoss[]; worst: SectorLoss | null } {
  const mine = sectorTimes(myRun.splitsMs, myRun.finishMs);
  const fieldSectors = fieldRuns.map((r) => sectorTimes(r.splitsMs, r.finishMs));
  const sectors: SectorLoss[] = mine.map((yourMs, i) => {
    const candidates = fieldSectors.map((s) => s[i]).filter((x): x is number => typeof x === "number" && x > 0);
    const bestMs = candidates.length ? Math.min(...candidates) : yourMs;
    return { sector: i + 1, lossMs: yourMs - bestMs, yourMs, bestMs };
  });
  // Only meaningful when there are real splits (more than one sector).
  const worst = sectors.length > 1 ? sectors.reduce((a, b) => (b.lossMs > a.lossMs ? b : a)) : null;
  return { sectors, worst };
}

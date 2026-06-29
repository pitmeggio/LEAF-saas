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

// ── Whole-session analysis (leaderboard + per-athlete sector breakdown) ───────
export type SessionRunInput = {
  athleteId: string; athleteName: string; bib: string | null;
  runNumber: number | null; finishMs: number | null; splitsMs: number[]; status: string | null;
};
export type AthleteSectorRow = {
  athleteId: string; name: string; bib: string | null;
  finishMs: number; runNumber: number | null; runCount: number;
  sectors: number[]; // this athlete's best run's sector times
  gapMs: number; // gap to the winner's finish
  worst: SectorLoss | null; // sector where they lost the most vs the field
  best: SectorLoss | null; // sector where they were strongest (smallest loss / a win)
};
export type SessionAnalysis = {
  leaders: AthleteSectorRow[];
  bestSectors: number[]; // fastest time in each sector across the field
  winnerMs: number | null;
  idealMs: number | null; // sum of the best sector times (theoretical best run)
  sectorCount: number;
  dnf: { athleteId: string; name: string }[];
};

// Build the full session picture: a leaderboard (best run per athlete) plus,
// for each athlete, their sector times, the gap to the winner, and which
// sector they lost the most in. `idealMs` is the sum of the fastest sector
// times — the "perfect run" the group is collectively capable of.
export function analyzeSession(runs: SessionRunInput[]): SessionAnalysis {
  const valid = runs.filter((r) => r.finishMs != null && (r.status == null || r.status === ""));
  const dnf = [...new Map(runs.filter((r) => r.finishMs == null).map((r) => [r.athleteId, { athleteId: r.athleteId, name: r.athleteName }])).values()];

  const best = bestPerAthlete(valid);
  const fieldRuns: RunLike[] = best.map((r) => ({ splitsMs: r.splitsMs, finishMs: r.finishMs }));
  const sectorCount = best.reduce((m, r) => Math.max(m, sectorTimes(r.splitsMs, r.finishMs).length), 0);

  const bestSectors: number[] = [];
  for (let i = 0; i < sectorCount; i++) {
    const cands = fieldRuns.map((r) => sectorTimes(r.splitsMs, r.finishMs)[i]).filter((x): x is number => typeof x === "number" && x > 0);
    bestSectors.push(cands.length ? Math.min(...cands) : 0);
  }
  const idealMs = sectorCount > 0 && bestSectors.every((x) => x > 0) ? bestSectors.reduce((a, b) => a + b, 0) : null;
  const winnerMs = best[0]?.finishMs ?? null;

  const runCounts = new Map<string, number>();
  for (const r of valid) runCounts.set(r.athleteId, (runCounts.get(r.athleteId) ?? 0) + 1);

  const leaders: AthleteSectorRow[] = best.map((r) => {
    const sectors = sectorTimes(r.splitsMs, r.finishMs);
    const { sectors: losses, worst } = sectorLoss({ splitsMs: r.splitsMs, finishMs: r.finishMs }, fieldRuns);
    const bestSector = losses.length > 1 ? losses.reduce((a, b) => (b.lossMs < a.lossMs ? b : a)) : null;
    return {
      athleteId: r.athleteId, name: r.athleteName, bib: r.bib,
      finishMs: r.finishMs as number, runNumber: r.runNumber, runCount: runCounts.get(r.athleteId) ?? 1,
      sectors, gapMs: (r.finishMs as number) - (winnerMs ?? (r.finishMs as number)),
      worst, best: bestSector,
    };
  });

  return { leaders, bestSectors, winnerMs, idealMs, sectorCount, dnf };
}

// Plain-language takeaway for one athlete in a session (deterministic "AI").
export function sectorTakeaway(row: AthleteSectorRow): string {
  if (row.gapMs === 0) return "Miglior tempo della sessione. 🏆";
  if (!row.worst || row.worst.lossMs <= 0) return "Tempo solido, settori in linea con i migliori.";
  const lost = (row.worst.lossMs / 1000).toFixed(2);
  const strong = row.best && row.best.lossMs <= 0 ? ` Settore ${row.best.sector} il tuo punto forte.` : "";
  return `Più tempo perso nel settore ${row.worst.sector}: +${lost}s dal migliore.${strong}`;
}

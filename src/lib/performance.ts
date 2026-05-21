// Pure performance analytics derived from an athlete's race results + ranking history.
// No DB, no privacy logic here — callers decide what to expose (see profiles.ts).

export type ResultInput = {
  date: Date;
  discipline: string;
  rank: number;
  fisPoints: number;
  status: string; // finished | dnf | dns | dsq
};
export type RankingInput = { date: Date; fisPoints: number };

export type PerformanceStats = {
  totalRaces: number;
  finishes: number;
  // free / basic
  bestFinish: number | null; // best (lowest) finishing place among finished races
  // premium
  pointsEvolution: { label: string; fisPoints: number }[]; // for the trend chart
  raceFrequency: { total: number; last12Months: number; perYear: { year: string; count: number }[] };
  disciplineSplit: { discipline: string; count: number; pct: number }[];
  consistency: { score: number | null; avgFinish: number | null }; // 0-100 (higher = steadier finishes)
  dnfPct: number; // (dnf+dns+dsq) / totalRaces * 100
  dnfCount: number;
  podiumPct: number; // rank<=3 / finishes * 100
  podiumCount: number;
};

const FINISHED = "finished";

export function computePerformance(results: ResultInput[], rankings: RankingInput[]): PerformanceStats {
  const total = results.length;
  const finished = results.filter((r) => r.status === FINISHED);
  const finishes = finished.length;
  const ranks = finished.map((r) => r.rank).filter((n) => n > 0);

  const bestFinish = ranks.length ? Math.min(...ranks) : null;

  // Points evolution (chart) from ranking history, oldest → newest.
  const pointsEvolution = [...rankings]
    .sort((a, b) => +a.date - +b.date)
    .map((p) => ({ label: p.date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), fisPoints: Math.round(p.fisPoints * 10) / 10 }));

  // Race frequency
  const now = Date.now();
  const yearAgo = now - 365 * 24 * 3600 * 1000;
  const last12Months = results.filter((r) => +r.date >= yearAgo).length;
  const byYear = new Map<string, number>();
  for (const r of results) {
    const y = String(r.date.getFullYear());
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const perYear = [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([year, count]) => ({ year, count }));

  // Discipline split
  const byDisc = new Map<string, number>();
  for (const r of results) byDisc.set(r.discipline, (byDisc.get(r.discipline) ?? 0) + 1);
  const disciplineSplit = [...byDisc.entries()]
    .map(([discipline, count]) => ({ discipline, count, pct: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // Consistency: steadier finishing places → higher score. Coefficient of variation of ranks.
  let consistencyScore: number | null = null;
  let avgFinish: number | null = null;
  if (ranks.length >= 2) {
    const mean = ranks.reduce((s, n) => s + n, 0) / ranks.length;
    avgFinish = Math.round(mean * 10) / 10;
    const variance = ranks.reduce((s, n) => s + (n - mean) ** 2, 0) / ranks.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    consistencyScore = Math.max(0, Math.min(100, Math.round(100 - cv * 100)));
  } else if (ranks.length === 1) {
    avgFinish = ranks[0];
  }

  // DNF / podium rates
  const dnfCount = results.filter((r) => r.status !== FINISHED).length;
  const dnfPct = total ? Math.round((dnfCount / total) * 100) : 0;
  const podiumCount = ranks.filter((n) => n <= 3).length;
  const podiumPct = finishes ? Math.round((podiumCount / finishes) * 100) : 0;

  return {
    totalRaces: total,
    finishes,
    bestFinish,
    pointsEvolution,
    raceFrequency: { total, last12Months, perYear },
    disciplineSplit,
    consistency: { score: consistencyScore, avgFinish },
    dnfPct,
    dnfCount,
    podiumPct,
    podiumCount,
  };
}

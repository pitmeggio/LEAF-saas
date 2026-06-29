import { prisma } from "@/lib/db";
import {
  SOURCE_META,
  FIT_LADDER,
  type TennisRankingSource,
  type RankSeriesPoint,
  type RankSummary,
  type AthleteTennisRankings,
} from "./ranking";

// Server-only read layer for tennis rankings. Split from ranking.ts so the
// client TennisRankingCard can import SOURCE_META + types without pulling
// prisma/pg into the browser bundle.
export async function getAthleteTennisRankings(athleteId: string): Promise<AthleteTennisRankings> {
  const [rows, athlete] = await Promise.all([
    prisma.tennisRankingSnapshot.findMany({ where: { athleteId }, orderBy: { date: "asc" } }),
    prisma.athlete.findUnique({ where: { id: athleteId }, select: { atpPlayerId: true, itfJuniorRef: true, fitTessera: true } }),
  ]);

  const bySource = new Map<TennisRankingSource, RankSeriesPoint[]>();
  for (const r of rows) {
    const src = r.source as TennisRankingSource;
    if (!SOURCE_META[src]) continue;
    const list = bySource.get(src) ?? bySource.set(src, []).get(src)!;
    list.push({ id: r.id, date: r.date.toISOString(), rank: r.rank, points: r.points, classifica: r.classifica, category: r.category, origin: r.origin });
  }

  const order: TennisRankingSource[] = ["FIT", "ITF", "ATP", "WTA"];
  const summaries: RankSummary[] = [];
  for (const src of order) {
    const series = bySource.get(src);
    if (!series || series.length === 0) continue;
    const latest = series[series.length - 1];
    const previous = series.length > 1 ? series[series.length - 2] : null;
    const rankDelta = latest.rank != null && previous?.rank != null ? latest.rank - previous.rank : null;
    let classificaSteps: number | null = null;
    if (latest.classifica && previous?.classifica) {
      const a = FIT_LADDER.indexOf(previous.classifica);
      const b = FIT_LADDER.indexOf(latest.classifica);
      if (a >= 0 && b >= 0) classificaSteps = a - b; // positive = moved toward best
    }
    summaries.push({ source: src, series, latest, previous, rankDelta, classificaSteps, origin: latest.origin });
  }

  return {
    summaries,
    codes: {
      atpPlayerId: athlete?.atpPlayerId ?? null,
      itfJuniorRef: athlete?.itfJuniorRef ?? null,
      fitTessera: athlete?.fitTessera ?? null,
    },
    hasAny: summaries.length > 0,
  };
}

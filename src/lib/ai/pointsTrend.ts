// Per-discipline FIS points trend — computed from FisListSnapshot rows.
// Pure math, no DB / no Prisma imports; the page passes in snapshots and
// the function returns the human-readable trend (improving / stable /
// declining) plus a sparkline-ready series.
//
// Drives the "GS improving · SL unstable" headline Marius asked for in his
// brief #2 (AI Performance Layer). Race-level DNF / rank analytics live in
// lib/ai/disciplineAnalytics.ts; this engine is the FIS-only complement
// that works on the data the official FIS export actually publishes.
//
// Trend label semantics (lower FIS points = better):
//   improving   — delta ≤ −0.5 points across the window
//   declining   — delta ≥ +0.5 points
//   stable      — within ±0.5
//   insufficient_data — <2 snapshots for that discipline

export type FisSnapshotInput = {
  publishedAt: Date;
  discipline: string;
  fisPoints: number;
  worldRank: number | null;
};

export type PointsTrendLabel = "improving" | "stable" | "declining" | "insufficient_data";

export type DisciplinePointsTrend = {
  discipline: string;
  label: string;             // human ("Giant Slalom")
  current: number;           // most recent FIS points
  earliest: number;          // first snapshot in the window
  delta: number;             // current − earliest (negative = improvement)
  trend: PointsTrendLabel;
  worldRankCurrent: number | null;
  worldRankEarliest: number | null;
  // Rank trend tells a story even when points are frozen (end-of-season,
  // injured, taking a break): the field moves around the athlete. Positive
  // rankDelta = sliding down the standings (worse); negative = climbing.
  rankDelta: number | null;
  rankTrend: PointsTrendLabel;
  sampleSize: number;        // number of snapshots feeding this trend
  // Best (lowest) and worst (highest) snapshots across the window. Coaches
  // anchor on these: "his best GS this season was 78.5 on Feb 26th".
  best: { fisPoints: number; date: Date } | null;
  worst: { fisPoints: number; date: Date } | null;
  // Number of times the points value CHANGED from one list to the next —
  // a proxy for "active race weeks" (FIS only recalculates points when a
  // new result enters the rolling window). 0 = totally inactive across
  // the window, sampleSize-1 = changed in every list (very rare).
  activeChanges: number;
  // Momentum = avg(second half) − avg(first half). Negative = improving
  // recently, positive = declining recently. Captures "where the trend is
  // headed RIGHT NOW" independently from the cumulative delta.
  momentum: number;
  series: { date: Date; fisPoints: number }[]; // oldest → newest, for sparkline
};

const DISCIPLINE_LABEL: Record<string, string> = {
  slalom: "Slalom",
  giant_slalom: "Giant Slalom",
  super_g: "Super-G",
  downhill: "Downhill",
};

const TREND_BAND = 0.5; // FIS points delta that flips "stable" into a real trend
const RANK_BAND = 5;     // world-rank delta below which we call it "stable"

export function computePointsTrendByDiscipline(
  snapshots: FisSnapshotInput[],
): DisciplinePointsTrend[] {
  // Bucket by discipline → sort oldest first.
  const byDisc = new Map<string, FisSnapshotInput[]>();
  for (const s of snapshots) {
    const arr = byDisc.get(s.discipline) ?? [];
    arr.push(s);
    byDisc.set(s.discipline, arr);
  }

  const out: DisciplinePointsTrend[] = [];
  for (const [discipline, raw] of byDisc) {
    const series = [...raw].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
    if (series.length === 0) continue;

    const first = series[0];
    const last = series[series.length - 1];
    const delta = last.fisPoints - first.fisPoints;

    let trend: PointsTrendLabel;
    if (series.length < 2) trend = "insufficient_data";
    else if (delta <= -TREND_BAND) trend = "improving";
    else if (delta >= TREND_BAND) trend = "declining";
    else trend = "stable";

    // Rank delta — lower number = better (rank 50 → 30 is improvement).
    let rankDelta: number | null = null;
    let rankTrend: PointsTrendLabel = "insufficient_data";
    if (first.worldRank != null && last.worldRank != null) {
      rankDelta = last.worldRank - first.worldRank;
      if (series.length < 2) rankTrend = "insufficient_data";
      else if (rankDelta <= -RANK_BAND) rankTrend = "improving";
      else if (rankDelta >= RANK_BAND) rankTrend = "declining";
      else rankTrend = "stable";
    }

    // Best / worst anchors across the window.
    let bestIdx = 0;
    let worstIdx = 0;
    for (let i = 1; i < series.length; i++) {
      if (series[i].fisPoints < series[bestIdx].fisPoints) bestIdx = i;
      if (series[i].fisPoints > series[worstIdx].fisPoints) worstIdx = i;
    }

    // Activity: count list-to-list changes (proxy for race weeks).
    let activeChanges = 0;
    for (let i = 1; i < series.length; i++) {
      if (Math.abs(series[i].fisPoints - series[i - 1].fisPoints) >= 0.01) activeChanges++;
    }

    // Momentum: avg(second half) − avg(first half). Negative = improving
    // recently. Falls back to overall delta when the window is too short
    // to split meaningfully (≤2 snapshots).
    let momentum = 0;
    if (series.length >= 4) {
      const mid = Math.floor(series.length / 2);
      const firstHalf = series.slice(0, mid);
      const secondHalf = series.slice(mid);
      const avg = (arr: typeof series) => arr.reduce((s, x) => s + x.fisPoints, 0) / arr.length;
      momentum = avg(secondHalf) - avg(firstHalf);
    } else {
      momentum = delta;
    }

    out.push({
      discipline,
      label: DISCIPLINE_LABEL[discipline] ?? discipline,
      current: round1(last.fisPoints),
      earliest: round1(first.fisPoints),
      delta: round1(delta),
      trend,
      worldRankCurrent: last.worldRank,
      worldRankEarliest: first.worldRank,
      rankDelta,
      rankTrend,
      sampleSize: series.length,
      best: { fisPoints: round1(series[bestIdx].fisPoints), date: series[bestIdx].publishedAt },
      worst: { fisPoints: round1(series[worstIdx].fisPoints), date: series[worstIdx].publishedAt },
      activeChanges,
      momentum: round1(momentum),
      series: series.map((s) => ({ date: s.publishedAt, fisPoints: s.fisPoints })),
    });
  }

  // Sort so the athlete's strongest discipline (lowest current points) leads.
  return out.sort((a, b) => a.current - b.current);
}

// Headline summary like "GS improving · SL unstable" — used in profile
// cards / search results where there's no room for a full table.
export function pointsTrendHeadline(trends: DisciplinePointsTrend[]): string {
  if (trends.length === 0) return "No FIS history yet";
  const SHORT: Record<string, string> = { slalom: "SL", giant_slalom: "GS", super_g: "SG", downhill: "DH" };
  return trends
    .slice(0, 3)
    .map((t) => {
      const tag = SHORT[t.discipline] ?? t.discipline;
      if (t.trend === "improving") return `${tag} improving`;
      if (t.trend === "declining") return `${tag} declining`;
      // Points stable but rank moved? Surface the rank signal (off-season /
      // injured athletes keep their points but their relative position
      // drifts as the field races on without them).
      if (t.trend === "stable") {
        if (t.rankTrend === "improving") return `${tag} rank ↑`;
        if (t.rankTrend === "declining") return `${tag} rank ↓`;
        return `${tag} stable`;
      }
      return `${tag} —`;
    })
    .join(" · ");
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

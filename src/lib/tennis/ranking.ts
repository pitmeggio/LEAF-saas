// LEAF — Tennis ranking layer.
//
// The tennis analogue of the FIS provider seam (src/lib/fis). An athlete
// carries an "athlete code" per federation (FIT tessera, ITF Junior ref,
// ATP/WTA player id). The import-by-code flow resolves that code against a
// TennisRankingProvider and upserts TennisRankingSnapshot rows; two or more
// snapshots per source draw the ranking trajectory on the Athlete Canvas.
//
// Two providers, same shape, swappable by env (TENNIS_RANKING_PROVIDER):
//   • simulated — deterministic demo data (offline screenshots / showing the
//                 full flow). Clearly badged "Demo" in the UI; never silently
//                 fabricates onto a real athlete without the yellow badge.
//   • live      — the real ITF/FIT/ATP connector. Stubbed today (returns
//                 null) — it is the single drop-in point when their public
//                 endpoints are wired. No live call means the import button
//                 tells the coach to use manual entry instead.

// NOTE: keep this module free of server-only imports (prisma/pg). It is
// imported by the client TennisRankingCard for SOURCE_META + types. The
// prisma read layer lives in ./rankingRead.ts.

export type TennisRankingSource = "FIT" | "ITF" | "ATP" | "WTA";

export const SOURCE_META: Record<TennisRankingSource, { label: string; full: string; color: string; kind: "classifica" | "rank" }> = {
  FIT: { label: "FIT", full: "Federazione Italiana Tennis", color: "#22c55e", kind: "classifica" },
  ITF: { label: "ITF", full: "ITF Junior World", color: "#3b82f6", kind: "rank" },
  ATP: { label: "ATP", full: "ATP World Tour", color: "#a78bfa", kind: "rank" },
  WTA: { label: "WTA", full: "WTA Tour", color: "#f472b6", kind: "rank" },
};

export type TennisRankingSnapshotData = {
  source: TennisRankingSource;
  date: string;        // ISO
  rank: number | null;
  points: number | null;
  classifica: string | null;
  category: string | null;
};

export interface TennisRankingProvider {
  /** Snapshots for one athlete code under one source, ascending by date. Empty when not found. */
  fetchByCode(source: TennisRankingSource, code: string): Promise<TennisRankingSnapshotData[]>;
  readonly sourceName: string;
}

export type TennisRankingMode = "live" | "simulated";

export function getTennisRankingMode(): TennisRankingMode {
  return (process.env.TENNIS_RANKING_PROVIDER ?? "simulated").toLowerCase() === "live" ? "live" : "simulated";
}

// ── Deterministic demo provider ────────────────────────────────────────────
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

// Italian classifica ladder, best → worst. Improving = move toward index 0.
export const FIT_LADDER = ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "3.1", "3.2", "3.3", "3.4", "3.5", "4.1", "4.2", "4.3", "4.NC"];

// Six monthly snapshots ending ~this month, trending to improvement.
function monthlyDates(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString());
  }
  return out;
}

export const simulatedTennisRankingProvider: TennisRankingProvider = {
  sourceName: "Demo",
  async fetchByCode(source, code) {
    const seed = hash(`${source}:${code}`);
    const dates = monthlyDates(6);
    if (source === "FIT") {
      const startIdx = 6 + (seed % 8);                 // start somewhere mid-ladder
      return dates.map((date, i) => {
        const idx = Math.max(0, startIdx - i);          // improve one step ~ per month
        return { source, date, rank: null, points: null, classifica: FIT_LADDER[idx], category: "Singolare" };
      });
    }
    // ITF / ATP / WTA — numeric world rank improving + points rising.
    const startRank = source === "ITF" ? 700 + (seed % 600) : 900 + (seed % 800);
    return dates.map((date, i) => {
      const rank = Math.max(40, Math.round(startRank * (1 - i * 0.11)));
      const points = Math.round((source === "ITF" ? 14 : 8) + i * (6 + (seed % 5)));
      return { source, date, rank, points, classifica: null, category: source === "ITF" ? "Junior" : "Singolare" };
    });
  },
};

// The real connector — single drop-in point. Today it resolves nothing, so the
// import action falls back to "use manual entry" rather than inventing data.
export const liveTennisRankingProvider: TennisRankingProvider = {
  sourceName: "ITF / FIT (live)",
  async fetchByCode() {
    return [];
  },
};

export function tennisRankingProvider(): TennisRankingProvider {
  return getTennisRankingMode() === "live" ? liveTennisRankingProvider : simulatedTennisRankingProvider;
}

// ── Read layer ──────────────────────────────────────────────────────────────
export type RankSeriesPoint = { date: string; rank: number | null; points: number | null; classifica: string | null; category: string | null; origin: string; id: string };

export type RankSummary = {
  source: TennisRankingSource;
  series: RankSeriesPoint[];   // ascending by date
  latest: RankSeriesPoint;
  previous: RankSeriesPoint | null;
  rankDelta: number | null;        // latest.rank - previous.rank (negative = improved)
  classificaSteps: number | null;  // ladder steps improved since previous (positive = better)
  origin: string;
};

export type AthleteTennisRankings = {
  summaries: RankSummary[];
  codes: { atpPlayerId: string | null; itfJuniorRef: string | null; fitTessera: string | null };
  hasAny: boolean;
};

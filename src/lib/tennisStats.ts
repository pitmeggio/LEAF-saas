// Tennis match analytics — pure functions over a list of match records.
// Lives apart from the panel so the math is testable and re-usable
// (Coach Dashboard / Reports could surface the same shapes later).

export type MatchLike = {
  date: Date | string;
  result: string;            // "won" | "lost"
  surface: string | null;    // "hard" | "clay" | "grass" | "indoor" | null
  opponent: string;
};

export type SurfaceRecord = {
  surface: string;           // "hard" | "clay" | "grass" | "indoor" | "unknown"
  wins: number;
  losses: number;
  winRate: number;           // 0..100
};

export type OpponentRecord = {
  opponent: string;
  wins: number;
  losses: number;
  total: number;
  // Stable canonical key for sorting / linking (lowercased + trimmed).
  key: string;
};

export type TennisStats = {
  total: number;
  wins: number;
  losses: number;
  winRate: number;           // 0..100
  // Recent form — last N results, oldest → newest so a streak reads left-to-right.
  recentForm: ("W" | "L")[];
  // Per-surface breakdown sorted by total matches desc.
  surfaces: SurfaceRecord[];
  // Top opponents by encounter count (most faced first), capped.
  topOpponents: OpponentRecord[];
  // Current win/loss streak (positive = wins, negative = losses).
  streak: number;
};

const MAX_OPPONENTS = 5;
const RECENT_FORM_LEN = 5;

export function deriveTennisStats(matches: MatchLike[]): TennisStats {
  const total = matches.length;
  const wins = matches.filter((m) => m.result === "won").length;
  const losses = total - wins;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  // Surface breakdown — null surfaces collapse into "unknown" so the totals
  // still sum to `total` and the UI shows where data is missing.
  const bySurface = new Map<string, { wins: number; losses: number }>();
  for (const m of matches) {
    const s = m.surface ?? "unknown";
    const cur = bySurface.get(s) ?? { wins: 0, losses: 0 };
    if (m.result === "won") cur.wins += 1; else cur.losses += 1;
    bySurface.set(s, cur);
  }
  const surfaces: SurfaceRecord[] = [...bySurface.entries()]
    .map(([surface, r]) => {
      const tot = r.wins + r.losses;
      return { surface, wins: r.wins, losses: r.losses, winRate: tot > 0 ? Math.round((r.wins / tot) * 100) : 0 };
    })
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

  // Recent form — last N. Sort by date desc, take N, reverse to chronological.
  const sortedDesc = [...matches].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const recentForm = sortedDesc.slice(0, RECENT_FORM_LEN).reverse().map((m) => (m.result === "won" ? "W" : "L") as "W" | "L");

  // Current streak — walk from most recent backwards while the result stays the same.
  let streak = 0;
  if (sortedDesc.length > 0) {
    const head = sortedDesc[0].result;
    for (const m of sortedDesc) {
      if (m.result !== head) break;
      streak += head === "won" ? 1 : -1;
    }
  }

  // Top opponents — dedup by normalised key (case-insensitive), sort by total.
  const byOpp = new Map<string, OpponentRecord>();
  for (const m of matches) {
    const key = m.opponent.trim().toLowerCase();
    if (!key) continue;
    const cur = byOpp.get(key) ?? { opponent: m.opponent.trim(), key, wins: 0, losses: 0, total: 0 };
    if (m.result === "won") cur.wins += 1; else cur.losses += 1;
    cur.total = cur.wins + cur.losses;
    byOpp.set(key, cur);
  }
  const topOpponents = [...byOpp.values()]
    .sort((a, b) => b.total - a.total || b.wins - a.wins)
    .slice(0, MAX_OPPONENTS);

  return { total, wins, losses, winRate, recentForm, surfaces, topOpponents, streak };
}

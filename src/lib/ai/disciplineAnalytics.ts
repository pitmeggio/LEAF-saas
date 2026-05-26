// Per-discipline performance analytics for ski athletes.
//
// Where computePerformance gives an athlete-wide summary, this engine
// breaks the results down into SL / GS / SG / DH (and any other discipline
// the athlete races) and derives:
//   - average finishing position per discipline
//   - DNF ratio per discipline
//   - FIS-points trend per discipline (improving / stable / declining)
//   - podium count per discipline
//
// Drives the "GS improving · SL unstable" callouts on the athlete profile
// and the discipline-aware AI insights. Pure (no I/O), unit-testable.

export type DisciplineResult = {
  date: Date | string;
  discipline: string;
  rank: number;
  fisPoints: number;
  status: string; // finished | dnf | dns | dsq
};

export type DisciplineTrend = "improving" | "stable" | "declining" | "insufficient_data";

export type DisciplineBreakdown = {
  discipline: string;            // raw key (slalom / giant_slalom / super_g / downhill / …)
  label: string;                 // human label (SL / GS / SG / DH / capitalised fallback)
  totalRaces: number;
  finishes: number;
  dnfCount: number;
  dnfPct: number;                // 0-100
  bestFinish: number | null;
  avgFinish: number | null;      // among finished races
  podiumCount: number;
  podiumPct: number;             // 0-100
  // Trend in FIS points within this discipline. Lower is better for ski,
  // so a downward slope = improving, upward = declining.
  fisTrend: DisciplineTrend;
  // Average FIS-points across the most recent N finished races minus the
  // average of the previous N — signed: negative = improving (lower better).
  fisDelta: number | null;
  // Consistency 0-100 — higher = steadier finishing positions.
  consistencyScore: number | null;
  recentSampleSize: number;      // how many recent races fed the trend
};

// Standard alpine ski discipline labels. Fallback returns the raw key
// capitalised so a third discipline (combined, parallel, …) still renders.
const DISCIPLINE_LABELS: Record<string, string> = {
  slalom: "SL",
  giant_slalom: "GS",
  super_g: "SG",
  downhill: "DH",
  combined: "AC",
  parallel: "PAR",
};
function labelFor(key: string): string {
  return DISCIPLINE_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const RECENT_WINDOW = 3; // last N finished races compared to the previous N

export function computeDisciplineBreakdown(results: DisciplineResult[]): DisciplineBreakdown[] {
  const byDisc = new Map<string, DisciplineResult[]>();
  for (const r of results) {
    const key = r.discipline || "unknown";
    const arr = byDisc.get(key) ?? [];
    arr.push({ ...r, date: typeof r.date === "string" ? new Date(r.date) : r.date });
    byDisc.set(key, arr);
  }

  const out: DisciplineBreakdown[] = [];
  for (const [discipline, rows] of byDisc) {
    const totalRaces = rows.length;
    const finishedRows = rows.filter((r) => r.status === "finished");
    const finishes = finishedRows.length;
    const dnfCount = totalRaces - finishes;
    const dnfPct = totalRaces ? Math.round((dnfCount / totalRaces) * 100) : 0;

    const ranks = finishedRows.map((r) => r.rank).filter((n) => n > 0);
    const bestFinish = ranks.length ? Math.min(...ranks) : null;
    const podiumCount = ranks.filter((n) => n <= 3).length;
    const podiumPct = finishes ? Math.round((podiumCount / finishes) * 100) : 0;

    // Average finishing position — only finished races count.
    let avgFinish: number | null = null;
    let consistencyScore: number | null = null;
    if (ranks.length >= 1) {
      const mean = ranks.reduce((s, n) => s + n, 0) / ranks.length;
      avgFinish = Math.round(mean * 10) / 10;
      if (ranks.length >= 2) {
        const variance = ranks.reduce((s, n) => s + (n - mean) ** 2, 0) / ranks.length;
        const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
        consistencyScore = Math.max(0, Math.min(100, Math.round(100 - cv * 100)));
      }
    }

    // FIS-points trend within discipline. Sort by date desc, split into
    // "recent" + "previous" buckets, compare averages.
    const sorted = [...finishedRows].sort((a, b) => +(b.date as Date) - +(a.date as Date));
    const recent = sorted.slice(0, RECENT_WINDOW);
    const previous = sorted.slice(RECENT_WINDOW, RECENT_WINDOW * 2);
    let fisTrend: DisciplineTrend = "insufficient_data";
    let fisDelta: number | null = null;
    if (recent.length >= 2 && previous.length >= 2) {
      const recentAvg = recent.reduce((s, r) => s + r.fisPoints, 0) / recent.length;
      const previousAvg = previous.reduce((s, r) => s + r.fisPoints, 0) / previous.length;
      fisDelta = Math.round((recentAvg - previousAvg) * 10) / 10;
      // Lower FIS-points = better; negative delta = improving.
      // Threshold: |delta| < 1.5 → stable (noise).
      if (Math.abs(fisDelta) < 1.5) fisTrend = "stable";
      else if (fisDelta < 0) fisTrend = "improving";
      else fisTrend = "declining";
    } else if (recent.length >= 2) {
      // Not enough history to compare buckets — show 'stable' to avoid scary
      // false signals on athletes with just 2-3 races.
      fisTrend = "stable";
    }

    out.push({
      discipline,
      label: labelFor(discipline),
      totalRaces,
      finishes,
      dnfCount,
      dnfPct,
      bestFinish,
      avgFinish,
      podiumCount,
      podiumPct,
      fisTrend,
      fisDelta,
      consistencyScore,
      recentSampleSize: recent.length,
    });
  }

  // Sort by races desc — primary discipline first.
  return out.sort((a, b) => b.totalRaces - a.totalRaces);
}

// Headline string for the athlete profile / dashboard.
// Examples:
//   "GS improving · SL unstable"
//   "SL stable · GS improving · SG insufficient data"
export function disciplineHeadline(breakdown: DisciplineBreakdown[]): string {
  if (breakdown.length === 0) return "No race data yet";
  const parts: string[] = [];
  for (const d of breakdown.slice(0, 3)) {
    if (d.fisTrend === "improving") parts.push(`${d.label} improving`);
    else if (d.fisTrend === "declining") parts.push(`${d.label} declining`);
    else if (d.fisTrend === "stable" && (d.consistencyScore ?? 0) < 50 && d.consistencyScore !== null) {
      parts.push(`${d.label} unstable`);
    } else if (d.fisTrend === "stable") {
      parts.push(`${d.label} stable`);
    } else {
      parts.push(`${d.label} new`);
    }
  }
  return parts.join(" · ");
}

// Suggested development focus — the AI nudge to coach + athlete.
// Maps observed weaknesses to one of: technical / tactical / physical / mental / race_management.
export type DevelopmentFocus = {
  area: "technical" | "tactical" | "physical" | "mental" | "race_management";
  label: string;
  reason: string;
  severity: "low" | "medium" | "high";
};

export function deriveDevelopmentFocus(breakdown: DisciplineBreakdown[]): DevelopmentFocus[] {
  const out: DevelopmentFocus[] = [];

  // High DNF in any discipline → race management focus
  const highDnf = breakdown.find((d) => d.totalRaces >= 4 && d.dnfPct >= 30);
  if (highDnf) {
    out.push({
      area: "race_management",
      label: "Race management",
      reason: `${highDnf.dnfPct}% DNF in ${highDnf.label} — work on getting to the finish line cleanly.`,
      severity: highDnf.dnfPct >= 50 ? "high" : "medium",
    });
  }

  // Declining FIS in technical disciplines (SL / GS) → technical focus
  const techDecline = breakdown.find(
    (d) => (d.discipline === "slalom" || d.discipline === "giant_slalom") && d.fisTrend === "declining",
  );
  if (techDecline) {
    out.push({
      area: "technical",
      label: "Technical (SL/GS)",
      reason: `${techDecline.label} FIS points trending up (worse) by ${techDecline.fisDelta}. Focus on edge work and line precision.`,
      severity: (techDecline.fisDelta ?? 0) > 8 ? "high" : "medium",
    });
  }

  // Low consistency in speed disciplines (SG / DH) → tactical/mental
  const speedInconsistent = breakdown.find(
    (d) => (d.discipline === "super_g" || d.discipline === "downhill") && (d.consistencyScore ?? 100) < 50 && d.finishes >= 3,
  );
  if (speedInconsistent) {
    out.push({
      area: "mental",
      label: "Race-pressure handling",
      reason: `${speedInconsistent.label} consistency at ${speedInconsistent.consistencyScore}% — finishing positions swing widely. Often a pressure/focus signal.`,
      severity: "medium",
    });
  }

  // Multi-discipline DNF pattern → physical / endurance
  const totalRaces = breakdown.reduce((s, d) => s + d.totalRaces, 0);
  const totalDnf = breakdown.reduce((s, d) => s + d.dnfCount, 0);
  const globalDnfPct = totalRaces ? (totalDnf / totalRaces) * 100 : 0;
  if (totalRaces >= 8 && globalDnfPct >= 25 && !highDnf) {
    out.push({
      area: "physical",
      label: "Endurance & strength",
      reason: `${Math.round(globalDnfPct)}% DNF across the season suggests a fitness / sustained-focus angle, not a single discipline.`,
      severity: "medium",
    });
  }

  // Low podium rate but solid finishes → tactical (race line + tactics)
  const tacticalGap = breakdown.find(
    (d) => d.finishes >= 4 && d.podiumPct === 0 && (d.avgFinish ?? 100) > 15,
  );
  if (tacticalGap && out.length < 3) {
    out.push({
      area: "tactical",
      label: "Tactical race line",
      reason: `${tacticalGap.label} finishes consistently mid-pack (avg #${tacticalGap.avgFinish}). Work on aggressive race line and gate-by-gate planning.`,
      severity: "low",
    });
  }

  return out;
}

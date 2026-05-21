import type { PerformanceStats } from "@/lib/performance";
import type { Forecast } from "@/lib/ai/forecast";
import { sportConfig } from "@/lib/sport";
import { DISCIPLINE_LABEL } from "@/lib/domain";

// ─────────────────────────────────────────────────────────────────────────────
// ATHLETE AI — training & race recommendations
//
// Turns the performance picture + forecast into a short, prioritised set of
// actionable next steps, each with the reason behind it. Deterministic and
// explainable — guidance, not prescription. Sport-aware.
// ─────────────────────────────────────────────────────────────────────────────

export type Recommendation = { priority: "high" | "medium" | "low"; focus: string; action: string; why: string };

export function deriveRecommendations(perf: PerformanceStats, forecast: Forecast, sport: string): Recommendation[] {
  const cfg = sportConfig(sport);
  const disc = (d: string) => DISCIPLINE_LABEL[d] ?? d.replace(/_/g, " ");
  const recs: Recommendation[] = [];

  // Regression risk (from forecast) — top priority.
  if (forecast.enoughData && forecast.risk.level !== "low") {
    recs.push({
      priority: forecast.risk.level === "high" ? "high" : "medium",
      focus: "Reverse the trend",
      action: "Review recent races with the coach and reset the training block.",
      why: `${cfg.pointsLabel} is projected to worsen — ${forecast.risk.note.toLowerCase()}`,
    });
  }

  // Consistency.
  if (perf.consistency.score != null && perf.consistency.score <= 55) {
    recs.push({
      priority: "high",
      focus: "Race-day consistency",
      action: "Prioritise repeatable execution over one-off peaks — same routine, same intent.",
      why: `Consistency ${perf.consistency.score}/100 — finishing places swing too much.`,
    });
  }

  // Finishing reliability.
  if (perf.totalRaces >= 5 && perf.dnfPct >= 25) {
    recs.push({
      priority: "medium",
      focus: "Reduce DNF risk",
      action: "Dial back risk in the top section; finish first, attack once it's banked.",
      why: `${perf.dnfPct}% of starts unfinished (${perf.dnfCount}/${perf.totalRaces}).`,
    });
  }

  // Race volume.
  if (perf.raceFrequency.last12Months <= 4) {
    recs.push({
      priority: "medium",
      focus: "Race more",
      action: "Add starts this season to build a richer record and move the ranking.",
      why: `Only ${perf.raceFrequency.last12Months} race(s) in the last 12 months.`,
    });
  }

  // Lean into the strongest discipline.
  const top = perf.disciplineSplit[0];
  if (top && top.pct >= 50 && perf.podiumPct < 20 && perf.finishes >= 4) {
    recs.push({
      priority: "low",
      focus: `Convert in ${disc(top.discipline)}`,
      action: `Target podium-level results where you already race most — ${disc(top.discipline)}.`,
      why: `${top.pct}% of races are ${disc(top.discipline)} but podium rate is ${perf.podiumPct}%.`,
    });
  }

  // Level-up signal: improving + already converting.
  if (forecast.enoughData && forecast.improving && perf.podiumPct >= 25) {
    recs.push({
      priority: "low",
      focus: "Step up the level",
      action: "Talk to the coach about a stronger group or higher-level events.",
      why: `Improving trend and a ${perf.podiumPct}% podium rate — ready for more.`,
    });
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  return recs.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 4);
}

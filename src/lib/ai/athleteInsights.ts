import type { PerformanceStats } from "@/lib/performance";
import { sportConfig } from "@/lib/sport";
import { DISCIPLINE_LABEL } from "@/lib/domain";

// ─────────────────────────────────────────────────────────────────────────────
// ATHLETE AI — performance insights (intelligence layer)
//
// Turns the raw PerformanceStats into prioritised, plain-language reads: strengths,
// areas to watch, and context. Deterministic + explainable — every insight is
// derived from a stat the athlete can verify. Sport-aware (ranking direction).
// ─────────────────────────────────────────────────────────────────────────────

export type AthleteInsight = { kind: "strength" | "watch" | "info"; title: string; detail: string };

export function deriveAthleteInsights(
  perf: PerformanceStats,
  opts: { sport: string; worldRank?: number | null },
): AthleteInsight[] {
  const cfg = sportConfig(opts.sport);
  const out: AthleteInsight[] = [];
  const disc = (d: string) => DISCIPLINE_LABEL[d] ?? d.replace(/_/g, " ");

  // Momentum from the ranking-points trajectory.
  const ev = perf.pointsEvolution;
  if (ev.length >= 2) {
    const delta = Math.round((ev[ev.length - 1].fisPoints - ev[0].fisPoints) * 10) / 10;
    const improving = cfg.pointsLowerIsBetter ? delta < 0 : delta > 0;
    const mag = Math.abs(delta);
    if (mag >= 1) {
      out.push(
        improving
          ? { kind: "strength", title: "Upward trajectory", detail: `${cfg.pointsLabel} improved by ${mag} across ${ev.length} updates — clear positive momentum.` }
          : { kind: "watch", title: "Form dip", detail: `${cfg.pointsLabel} slipped by ${mag} over the tracked period — worth a closer look.` },
      );
    } else {
      out.push({ kind: "info", title: "Holding level", detail: `${cfg.pointsLabel} broadly stable across the period.` });
    }
  }

  // Strongest discipline.
  const top = perf.disciplineSplit[0];
  if (top && top.count > 0) {
    const best = perf.bestFinish != null ? ` Best finish: ${ordinal(perf.bestFinish)}.` : "";
    out.push({ kind: "strength", title: `Strongest in ${disc(top.discipline)}`, detail: `${top.pct}% of races are ${disc(top.discipline)}.${best}` });
  }

  // Consistency.
  if (perf.consistency.score != null) {
    const s = perf.consistency.score;
    if (s >= 70) out.push({ kind: "strength", title: "Highly consistent", detail: `Consistency ${s}/100 — finishing places cluster tightly${perf.consistency.avgFinish != null ? ` (avg ${perf.consistency.avgFinish})` : ""}.` });
    else if (s <= 45) out.push({ kind: "watch", title: "Volatile results", detail: `Consistency ${s}/100 — finishing places swing widely. Stabilising race-day execution is the biggest lever.` });
    else out.push({ kind: "info", title: "Moderate consistency", detail: `Consistency ${s}/100${perf.consistency.avgFinish != null ? ` · avg finish ${perf.consistency.avgFinish}` : ""}.` });
  }

  // Podium conversion.
  if (perf.finishes >= 4) {
    if (perf.podiumPct >= 20) out.push({ kind: "strength", title: "Strong podium rate", detail: `${perf.podiumPct}% of finishes end on the podium (${perf.podiumCount}/${perf.finishes}).` });
    else if (perf.podiumPct === 0) out.push({ kind: "info", title: "Podium still to come", detail: `No podiums in the tracked window — top results are the next step up.` });
  }

  // Race density.
  const l12 = perf.raceFrequency.last12Months;
  if (l12 >= 10) out.push({ kind: "strength", title: "High race volume", detail: `${l12} races in the last 12 months — plenty of competitive reps.` });
  else if (l12 <= 3) out.push({ kind: "watch", title: "Limited recent racing", detail: `${l12} race${l12 === 1 ? "" : "s"} in the last 12 months — thin recent sample to judge form.` });

  // Reliability.
  if (perf.totalRaces >= 5) {
    if (perf.dnfPct <= 10) out.push({ kind: "strength", title: "Reliable finisher", detail: `Only ${perf.dnfPct}% of starts unfinished (${perf.dnfCount}/${perf.totalRaces}).` });
    else if (perf.dnfPct >= 25) out.push({ kind: "watch", title: "Finishing risk", detail: `${perf.dnfPct}% of starts unfinished (${perf.dnfCount}/${perf.totalRaces}) — risk management could unlock points.` });
  }

  // Benchmark context.
  if (opts.worldRank != null) out.push({ kind: "info", title: "Current standing", detail: `${cfg.rankLabel}: #${opts.worldRank}.` });

  // Prioritise: strengths first, then watch, then info; cap the list.
  const order = { strength: 0, watch: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, 6);
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

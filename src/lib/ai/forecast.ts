import { sportConfig } from "@/lib/sport";

// ─────────────────────────────────────────────────────────────────────────────
// ATHLETE AI — predictive layer (projected ranking + progression + regression risk)
//
// A transparent least-squares trend projection over the athlete's ranking-points
// history. No black box: the projection is a fitted line extended forward, with a
// confidence read from sample size + scatter, and a regression-risk flag derived
// from the slope direction (sport-aware) and volatility. Clearly marked beta.
// ─────────────────────────────────────────────────────────────────────────────

export type Forecast = {
  enoughData: boolean;
  currentPoints: number | null;
  projectedPoints: number | null;
  periodsAhead: number;
  deltaPoints: number | null; // projected - current
  improving: boolean;
  confidence: "low" | "medium" | "high";
  trajectory: string;
  risk: { level: "low" | "medium" | "high"; note: string };
};

export function forecastTrajectory(
  pointsEvolution: { label: string; fisPoints: number }[],
  sport: string,
  periodsAhead = 3,
): Forecast {
  const cfg = sportConfig(sport);
  const ys = pointsEvolution.map((p) => p.fisPoints);
  const n = ys.length;

  if (n < 3) {
    return { enoughData: false, currentPoints: n ? ys[n - 1] : null, projectedPoints: null, periodsAhead, deltaPoints: null, improving: false, confidence: "low", trajectory: "Not enough history yet to project.", risk: { level: "low", note: "Need at least 3 data points." } };
  }

  // Least-squares fit: y = m·x + b over x = 0..n-1.
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const m = den === 0 ? 0 : num / den;
  const b = my - m * mx;

  // Residual scatter → confidence.
  let ssRes = 0;
  for (let i = 0; i < n; i++) { const pred = m * xs[i] + b; ssRes += (ys[i] - pred) ** 2; }
  const rmse = Math.sqrt(ssRes / Math.max(1, n - 2));
  const relScatter = my > 0 ? rmse / my : 1;

  const current = ys[n - 1];
  const projected = Math.max(0, Math.round((m * (n - 1 + periodsAhead) + b) * 10) / 10);
  const delta = Math.round((projected - current) * 10) / 10;

  // Sport-aware: for FIS points lower is better, so a negative slope = improving.
  const improving = cfg.pointsLowerIsBetter ? m < 0 : m > 0;

  const confidence: Forecast["confidence"] = n >= 8 && relScatter < 0.15 ? "high" : n >= 5 && relScatter < 0.3 ? "medium" : "low";

  const dir = improving ? "improving" : Math.abs(m) < 0.05 ? "holding steady" : "regressing";
  const trajectory =
    dir === "holding steady"
      ? `Projection holds near ${projected} ${cfg.pointsLabel.toLowerCase()} over the next ${periodsAhead} updates.`
      : `On current trend, ${cfg.pointsLabel} projects to ~${projected} in ${periodsAhead} updates (${improving ? "better" : "worse"} by ${Math.abs(delta)}).`;

  // Regression risk: worsening slope + scatter.
  const worsening = !improving && Math.abs(m) >= 0.05;
  let risk: Forecast["risk"];
  if (worsening && relScatter >= 0.25) risk = { level: "high", note: "Worsening trend with volatile results — intervention advised." };
  else if (worsening) risk = { level: "medium", note: "Trend drifting the wrong way — monitor closely." };
  else if (relScatter >= 0.35) risk = { level: "medium", note: "Results are volatile — projection is uncertain." };
  else risk = { level: "low", note: "Stable, low-risk trajectory." };

  return { enoughData: true, currentPoints: current, projectedPoints: projected, periodsAhead, deltaPoints: delta, improving, confidence, trajectory, risk };
}

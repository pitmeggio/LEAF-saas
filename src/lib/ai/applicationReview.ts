import { sportConfig } from "@/lib/sport";

// ─────────────────────────────────────────────────────────────────────────────
// ACADEMY AI — Application review (fit score + risk flags)
//
// Sits on top of the admissions workflow: scores how well an applicant fits the
// academy and surfaces the risks a reviewer should check before deciding. Pairs
// with Smart Group Assignment (the best group-fit feeds the score). Deterministic
// and explainable — advisory only, never auto-decides.
// ─────────────────────────────────────────────────────────────────────────────

export type FitFactor = { label: string; delta: number }; // contribution to the score
export type RiskFlag = { severity: "high" | "medium" | "low"; label: string };

export type ApplicationReviewInput = {
  sport: string;
  age: number | null;
  verified: boolean;
  hasFederationCode: boolean;
  resultsCount: number;
  finishedCount: number;
  dnfCount: number;
  podiumCount: number;
  recentRaces12m: number;
  trendDeltaPoints: number | null; // sign per sport
  guardianProvided: boolean;
  bestGroupFit: number | null; // top eligible group fit score (0–100) from Smart Group Assignment
};

export type ApplicationReview = {
  fitScore: number; // 0–100
  band: "strong" | "moderate" | "weak";
  factors: FitFactor[];
  flags: RiskFlag[];
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function reviewApplication(i: ApplicationReviewInput): ApplicationReview {
  const cfg = sportConfig(i.sport);
  const factors: FitFactor[] = [];
  let score = 35; // baseline

  // Group fit is the dominant signal — how well they slot into a real team.
  if (i.bestGroupFit != null) {
    const d = Math.round((i.bestGroupFit / 100) * 30);
    factors.push({ label: `Best group fit ${i.bestGroupFit}/100`, delta: d });
    score += d;
  } else {
    factors.push({ label: "No group band matched", delta: -5 });
    score -= 5;
  }

  // Verified, federation-linked record.
  if (i.verified) { factors.push({ label: "Verified profile", delta: 8 }); score += 8; }
  if (i.hasFederationCode) { factors.push({ label: `${cfg.federation} code on file`, delta: 5 }); score += 5; }

  // Competition record depth + quality.
  if (i.resultsCount >= 5) { factors.push({ label: "Solid race record", delta: 6 }); score += 6; }
  else if (i.resultsCount === 0) { factors.push({ label: "No results on file", delta: -8 }); score -= 8; }
  if (i.podiumCount > 0) { factors.push({ label: `${i.podiumCount} podium${i.podiumCount === 1 ? "" : "s"}`, delta: 7 }); score += 7; }

  // Momentum.
  if (i.trendDeltaPoints != null && i.trendDeltaPoints !== 0) {
    const improving = cfg.pointsLowerIsBetter ? i.trendDeltaPoints < 0 : i.trendDeltaPoints > 0;
    factors.push({ label: improving ? "Improving trend" : "Declining trend", delta: improving ? 9 : -9 });
    score += improving ? 9 : -9;
  }

  // Recent activity.
  if (i.recentRaces12m >= 5) { factors.push({ label: "Active this season", delta: 5 }); score += 5; }
  else if (i.recentRaces12m <= 1) { factors.push({ label: "Little recent racing", delta: -6 }); score -= 6; }

  const fitScore = clamp(Math.round(score));
  const band = fitScore >= 70 ? "strong" : fitScore >= 45 ? "moderate" : "weak";

  // ── Risk flags ──
  const flags: RiskFlag[] = [];
  if (i.bestGroupFit == null || i.bestGroupFit < 45) flags.push({ severity: "medium", label: "No group cleanly matches their level" });
  if (i.resultsCount === 0) flags.push({ severity: "high", label: "Sparse competition record — hard to assess" });
  if (i.finishedCount > 0 && i.dnfCount / Math.max(1, i.resultsCount) >= 0.25) flags.push({ severity: "medium", label: "High DNF rate" });
  if (i.trendDeltaPoints != null && (cfg.pointsLowerIsBetter ? i.trendDeltaPoints > 0 : i.trendDeltaPoints < 0)) flags.push({ severity: "medium", label: "Form trending the wrong way" });
  if (i.recentRaces12m <= 1) flags.push({ severity: "low", label: "Limited racing in the last 12 months" });
  if (!i.verified) flags.push({ severity: "low", label: "Unverified profile" });
  if (i.age != null && i.age < 18 && !i.guardianProvided) flags.push({ severity: "high", label: "Minor — guardian contact missing" });

  return { fitScore, band, factors, flags };
}

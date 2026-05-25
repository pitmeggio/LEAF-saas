// LEAF athlete status — derives the access tier from the athlete's state.
//
// Architecture: ONE athlete = ONE profile (/me). What the athlete sees is
// progressively unlocked by their status. Pure derivation here so the same
// rule applies on the athlete's own /me, the admin view, and any other
// surface that needs to know "what can this athlete access".
//
//   free      → identity, sport data, basic AI insights, basic trends
//   premium   → adds advanced AI, predictive trends, season comparisons
//   enrolled  → adds coach/team/calendar/documents/payments + premium for free
//
// An academy-enrolled athlete gets premium unlocked automatically — the
// academy pays for the relationship, the athlete doesn't double-pay.

export type AthleteStatus = "free" | "premium" | "enrolled";

export type AthleteStatusInput = {
  // Active enrolments at any LEAF academy (status filtering happens upstream).
  enrolledAcademiesCount: number;
  // Premium subscription flag (set by the payment integration when it lands).
  // For the MVP: always false unless explicitly set.
  premiumSubscriber?: boolean;
};

export function getAthleteStatus(input: AthleteStatusInput): AthleteStatus {
  if (input.enrolledAcademiesCount > 0) return "enrolled";
  if (input.premiumSubscriber) return "premium";
  return "free";
}

// Capability flags derived from status. Centralised so every surface asks
// the same questions instead of branching on status literals everywhere.
export type AthleteCapabilities = {
  // Always on for every athlete — identity, sport-native ranking, results,
  // basic AI trend + insights.
  baseProfile: true;
  // Premium intelligence: forecast, recommendations, season comparison.
  advancedAi: boolean;
  // Academy-only modules: coach notes (read-only), team, calendar, documents,
  // payments, communication.
  academyModules: boolean;
  // True when premium would unlock something the athlete doesn't have yet —
  // drives the "Upgrade" CTA on the workspace.
  showUpgradeCTA: boolean;
};

export function deriveAthleteCapabilities(status: AthleteStatus): AthleteCapabilities {
  switch (status) {
    case "enrolled":
      return { baseProfile: true, advancedAi: true, academyModules: true, showUpgradeCTA: false };
    case "premium":
      return { baseProfile: true, advancedAi: true, academyModules: false, showUpgradeCTA: false };
    case "free":
    default:
      return { baseProfile: true, advancedAi: false, academyModules: false, showUpgradeCTA: true };
  }
}

// Human label for the status — used by the workspace badge + admin chips.
export function athleteStatusLabel(status: AthleteStatus): string {
  switch (status) {
    case "enrolled": return "Enrolled · academy member";
    case "premium":  return "Premium";
    case "free":     return "Free";
  }
}

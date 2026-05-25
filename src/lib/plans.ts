// Plan tiers and what each unlocks. Used for provisioning defaults (when a tenant
// is created/assigned a plan) and for display in the super-admin portal. Per-academy
// feature flags can override these — the plan defines sensible starting points.

export type PlanKey = "BASIC" | "PRO" | "ELITE";

export type PlanDef = {
  key: PlanKey;
  label: string;
  maxAthletes: number | null; // null = unlimited
  features: {
    featureRecruiting: boolean;
    featurePublicProfiles: boolean;
    featureFinance: boolean;
    featureChat: boolean;
  };
  blurb: string;
};

export const PLANS: Record<PlanKey, PlanDef> = {
  BASIC: {
    key: "BASIC",
    label: "Basic",
    maxAthletes: 25,
    // Public profiles default to OFF — they're only meaningful once we ship
    // a real discovery / marketplace layer. Super admin can flip per-academy
    // for early-adopter / showcase tenants.
    features: { featureRecruiting: false, featurePublicProfiles: false, featureFinance: false, featureChat: true },
    blurb: "Core roster and messaging.",
  },
  PRO: {
    key: "PRO",
    label: "Pro",
    maxAthletes: 100,
    features: { featureRecruiting: true, featurePublicProfiles: false, featureFinance: true, featureChat: true },
    blurb: "Adds recruiting and full finance.",
  },
  ELITE: {
    key: "ELITE",
    label: "Elite",
    maxAthletes: null,
    features: { featureRecruiting: true, featurePublicProfiles: false, featureFinance: true, featureChat: true },
    blurb: "Unlimited athletes, every module.",
  },
};

export function planDef(plan: string): PlanDef {
  return PLANS[(plan as PlanKey)] ?? PLANS.BASIC;
}

// The live, effective feature set for an academy: its per-tenant flags (which the
// super-admin can toggle) are the source of truth at runtime.
export type AcademyFeatureFlags = {
  featureRecruiting: boolean;
  featurePublicProfiles: boolean;
  featureFinance: boolean;
  featureChat: boolean;
};

export function academyFeatures(a: Partial<AcademyFeatureFlags> | null | undefined): AcademyFeatureFlags {
  return {
    featureRecruiting: a?.featureRecruiting ?? true,
    // Public profiles are OFF by default until the discovery / marketplace
    // layer is live — keeps the athlete + admin UX honest about what the
    // feature actually does today.
    featurePublicProfiles: a?.featurePublicProfiles ?? false,
    featureFinance: a?.featureFinance ?? true,
    featureChat: a?.featureChat ?? true,
  };
}

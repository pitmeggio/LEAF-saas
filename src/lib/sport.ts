// Per-sport presentation config. The athlete profile is a single template; this
// map drives all sport-specific language and metric semantics so a ski athlete
// sees "FIS points · lower is better" while a tennis athlete sees "ATP ranking".
// Unknown sports fall back to neutral, federation-agnostic copy.

export type SportConfig = {
  label: string; // human label for the sport
  federation: string; // governing body shown publicly (e.g. "FIS", "ATP")
  codeLabel: string; // what the athlete's id is called ("FIS code", "ATP player ID")
  pointsLabel: string; // ranking-points metric name ("FIS points", "ATP points")
  rankLabel: string; // standing metric name ("World rank", "ATP ranking")
  disciplineLabel: string; // grouping term ("Discipline", "Surface / event")
  // For points: ski FIS points are a penalty (lower = better); tennis points are
  // earned (higher = better). Drives the "lower/higher is better" hint + trend colour.
  pointsLowerIsBetter: boolean;
  pointsHint: string;
  profileLinkLabel: string; // external profile link text
};

const GENERIC: SportConfig = {
  label: "Athlete",
  federation: "Federation",
  codeLabel: "Federation code",
  pointsLabel: "Ranking points",
  rankLabel: "World rank",
  disciplineLabel: "Discipline",
  pointsLowerIsBetter: false,
  pointsHint: "higher is better",
  profileLinkLabel: "Official profile",
};

export const SPORT: Record<string, SportConfig> = {
  ski: {
    label: "Alpine skiing",
    federation: "FIS",
    codeLabel: "FIS code",
    pointsLabel: "FIS points",
    rankLabel: "World rank",
    disciplineLabel: "Discipline",
    pointsLowerIsBetter: true,
    pointsHint: "lower is better",
    profileLinkLabel: "FIS profile",
  },
  tennis: {
    label: "Tennis",
    federation: "ATP / WTA",
    codeLabel: "ATP / WTA ID",
    pointsLabel: "Ranking points",
    rankLabel: "World ranking",
    disciplineLabel: "Surface",
    pointsLowerIsBetter: false,
    pointsHint: "higher is better",
    profileLinkLabel: "ATP profile",
  },
};

export function sportConfig(sport: string | null | undefined): SportConfig {
  return (sport && SPORT[sport]) || GENERIC;
}

// Sports offered as first-class options in onboarding / create-profile flows.
export const PRIMARY_SPORTS: { key: string; label: string }[] = [
  { key: "ski", label: "Alpine skiing" },
  { key: "tennis", label: "Tennis" },
];

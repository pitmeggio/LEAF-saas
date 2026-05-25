// Sport Module — describes everything LEAF needs to know to render an academy
// of a given sport. The platform core (users / applications / payments / groups
// / coach notes / messaging / reports / AI) is sport-agnostic. Anything that
// looks or feels sport-specific reads from a SportModule instead of branching
// on `sport === "tennis"` everywhere.
//
// To add a new sport (cycling, padel, football…): write one of these,
// register it, done. No core changes required.

export type SportKey = "ski" | "tennis" | "padel" | "cycling" | "football" | string;

// A sport-specific column in the Athletes list. The page keeps the universal
// columns (Athlete / Status / Level / Group / Coach / Payments / Docs) and
// only the columns in between change per sport, so a new sport doesn't have
// to redeclare everything. The renderer reads `field` and falls back to "—"
// when the value is missing.
export type AthleteListColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
  field: string;
  hint?: string;
};

// A headline KPI on the Overview dashboard for this sport. The renderer
// already knows how to display the value — the module supplies the question.
export type DashboardKpi = {
  key: string;
  label: string;
  // The data source the renderer should look up. Keep this small + recognised
  // by the page; the page maps each to its computed value.
  source:
    | "totalAthletes"
    | "activeApplications"
    | "seasonRevenue"
    | "pendingPayments"
    | "budgetUsage"
    | "performanceAlerts"
    | "matchesThisSeason"   // tennis
    | "avgWinRate"          // tennis
    | "avgFisProgression";  // ski
  hint?: string;
};

// Coach Intelligence — keyword themes per sport. The deterministic engine
// already uses these (in lib/ai/coachNotes.ts); pulling them into the module
// makes adding a new sport a matter of writing one config object.
export type CoachNotesConfig = {
  // Keyword map: theme → list of phrases that trigger it.
  themes: Record<string, string[]>;
  // Placeholder text the composer shows for this sport.
  composerPlaceholder: string;
};

// Where in the public Athlete profile we surface the headline metric.
export type PublicProfileConfig = {
  // Heading shown above the primary metric ("FIS points", "Match record").
  primaryMetricLabel: string;
  // Field key on the athlete record that holds the metric.
  primaryMetricField: string;
  // Has a numeric "lower is better" semantic? (FIS) Otherwise default higher-is-better.
  lowerIsBetter?: boolean;
};

export type SportModule = {
  key: SportKey;
  label: string;                 // human label ("Alpine skiing", "Tennis")
  short: string;                 // 3-4 letter compact label ("SKI", "TENNIS")
  icon: string;                  // emoji / unicode mark
  accentColor?: string;          // optional override of the global accent for this sport
  // ── Capabilities ──
  // Whether this sport uses federation-driven ranking (FIS, ATP, …).
  hasFederationRanking: boolean;
  // Whether this sport has match records (W/L per opponent).
  hasMatchRecord: boolean;
  // Whether this sport has development-based 1..10 levels (T/T/P/M).
  hasDevelopmentLevels: boolean;
  // Whether this sport has discipline breakdown (SL/GS/SG/DH for ski).
  hasDisciplineSplit: boolean;
  // ── UI ──
  athletesListColumns: AthleteListColumn[];
  dashboardKpis: DashboardKpi[];
  coachNotes: CoachNotesConfig;
  publicProfile: PublicProfileConfig;
};

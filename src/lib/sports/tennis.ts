import type { SportModule } from "@/lib/sports/types";

// Tennis module. Coach-driven (no federation feed required for the MVP),
// match-centric, development-based 1..10 levels per dimension.

export const tennisModule: SportModule = {
  key: "tennis",
  label: "Tennis",
  short: "TENNIS",
  icon: "🎾",
  hasFederationRanking: false,
  hasMatchRecord: true,
  hasDevelopmentLevels: true,
  hasDisciplineSplit: false,

  // Sport-specific columns inserted between Coach and Payments on the
  // Athletes list. Win rate + recent form land in a follow-up (need the
  // match data layer to avoid N+1 in the list query).
  athletesListColumns: [
    { key: "playingStyle", label: "Stile", field: "playingStyle" },
    { key: "levels", label: "T / T / F / M", field: "tennisLevels", align: "right", hint: "Tecnico / Tattico / Fisico / Mentale, 1–10" },
  ],

  dashboardKpis: [
    { key: "athletes", label: "Atleti totali", source: "totalAthletes" },
    { key: "applications", label: "Iscrizioni attive", source: "activeApplications" },
    { key: "matches", label: "Partite stagione", source: "matchesThisSeason" },
    { key: "winRate", label: "% vittorie media", source: "avgWinRate" },
    { key: "revenue", label: "Ricavi stagione", source: "seasonRevenue" },
    { key: "pending", label: "Pagamenti in sospeso", source: "pendingPayments" },
  ],

  coachNotes: {
    composerPlaceholder:
      "e.g. Match against Marco. Serve inconsistent first set. Backhand patterns improved after grip change. Strong rally up the line. Felt soreness in the right shoulder by the third set.",
    themes: {
      technical: ["serve", "forehand", "backhand", "volley", "slice", "topspin", "grip", "swing", "footwork stroke", "racket", "racquet"],
      tactical: ["pattern", "rally", "shot selection", "placement", "depth", "court position", "approach", "drop shot", "tactic"],
      physical: ["movement", "endurance", "explosive", "recovery between points", "footwork", "fatigue", "stamina"],
      mental: ["focus", "pressure", "tie break", "tiebreak", "match point", "set point", "nervous", "composure", "head"],
      match: ["match", "set", "game", "break", "rally"],
      injury: ["shoulder", "elbow", "wrist", "knee", "pain", "soreness", "injury"],
      recovery: ["recovery", "rest", "ice", "physio", "massage", "stretch"],
    },
  },

  publicProfile: {
    primaryMetricLabel: "Win rate",
    primaryMetricField: "tennisWinRate",
    lowerIsBetter: false,
  },
};

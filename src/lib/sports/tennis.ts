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

  athletesListColumns: [
    { key: "athlete", label: "Athlete", field: "name", align: "left" },
    { key: "playingStyle", label: "Style", field: "playingStyle" },
    { key: "levels", label: "T / T / P / M", field: "tennisLevels", align: "right", hint: "Technical / Tactical / Physical / Mental, 1–10" },
    { key: "winRate", label: "Win rate", field: "tennisWinRate", align: "right" },
    { key: "trend", label: "Form", field: "tennisRecentForm" },
  ],

  dashboardKpis: [
    { key: "athletes", label: "Total athletes", source: "totalAthletes" },
    { key: "applications", label: "Active applications", source: "activeApplications" },
    { key: "matches", label: "Matches this season", source: "matchesThisSeason" },
    { key: "winRate", label: "Avg win rate", source: "avgWinRate" },
    { key: "revenue", label: "Season revenue", source: "seasonRevenue" },
    { key: "pending", label: "Pending payments", source: "pendingPayments" },
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

import type { SportModule } from "@/lib/sports/types";

// Alpine skiing module. Federation-driven (FIS), race-centric, discipline
// breakdown (SL / GS / SG / DH). Keep this file the single source of truth
// for anything that looks "ski-specific" in the UI.

export const skiModule: SportModule = {
  key: "ski",
  label: "Alpine skiing",
  short: "SKI",
  icon: "⛷",
  hasFederationRanking: true,
  hasMatchRecord: false,
  hasDevelopmentLevels: false,
  hasDisciplineSplit: true,

  athletesListColumns: [
    { key: "athlete", label: "Athlete", field: "name", align: "left" },
    { key: "discipline", label: "Discipline", field: "discipline" },
    { key: "fisPoints", label: "FIS pts", field: "fisPoints", align: "right", hint: "lower is better" },
    { key: "worldRank", label: "World rank", field: "worldRank", align: "right" },
    { key: "trend", label: "Trend", field: "trend" },
  ],

  dashboardKpis: [
    { key: "athletes", label: "Total athletes", source: "totalAthletes" },
    { key: "applications", label: "Active applications", source: "activeApplications" },
    { key: "revenue", label: "Season revenue", source: "seasonRevenue" },
    { key: "pending", label: "Pending payments", source: "pendingPayments" },
    { key: "budget", label: "Budget usage", source: "budgetUsage" },
    { key: "alerts", label: "Performance alerts", source: "performanceAlerts", hint: "athletes trending down" },
  ],

  coachNotes: {
    composerPlaceholder:
      "e.g. Saas-Fee GS session. Edges strong, line clean. Pressure on outside ski improving. Nervous at start, recovered focus by 2nd run. Tired at the end.",
    themes: {
      technical: ["edge", "edges", "edging", "pressure", "balance", "stance", "line", "split", "carving", "angulation", "inclination", "upper body", "hip", "core position"],
      tactical: ["line choice", "race line", "tactical", "course", "section", "gate", "set"],
      physical: ["fatigue", "tired", "explosive", "explosiveness", "strength", "endurance", "cardio", "conditioning", "leg"],
      mental: ["focus", "nervous", "pressure", "anxious", "confidence", "composed", "doubt", "motivation", "head"],
      race: ["race", "qualifier", "fis race", "world cup", "tempo", "split time"],
      injury: ["pain", "knee", "back", "shoulder", "ankle", "injury", "concussion", "sore"],
      recovery: ["recovery", "rest", "ice", "physio", "massage", "stretch"],
    },
  },

  publicProfile: {
    primaryMetricLabel: "FIS points",
    primaryMetricField: "fisPoints",
    lowerIsBetter: true,
  },
};

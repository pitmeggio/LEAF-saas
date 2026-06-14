// Template definitions for the coach's training / race programme — mirrors the
// two Excel sheets the Trysil coach sends on WhatsApp ("Race Academy · Ski
// Faster"). The OS form renders these rows, the APP shows the same labels
// read-only. place / discipline / date are real columns; everything else is a
// key→value in TrainingProgram.fields, driven by this config. DB-free so it can
// be shared by server + client.

export type ProgramKind = "training" | "race";
export type FieldRow = { key: string; label: string };
export type Section = { title: string; rows: FieldRow[] };

const TRAINING_SECTIONS: Section[] = [
  {
    title: "Logistica",
    rows: [
      { key: "slope", label: "Slope" },
      { key: "nextDay", label: "Next day" },
      { key: "breakfast", label: "Breakfast" },
      { key: "lunch", label: "Lunch" },
      { key: "dinner", label: "Dinner" },
      { key: "packing", label: "Packing" },
      { key: "departure", label: "Departure" },
    ],
  },
  {
    title: "Impianti",
    rows: [
      { key: "lift", label: "Lift" },
      { key: "lifttickets", label: "Lifttickets" },
      { key: "coaches", label: "Coaches" },
      { key: "promocode", label: "Promocode" },
      { key: "athletes", label: "Athletes" },
    ],
  },
  {
    title: "Sessione",
    rows: [
      { key: "sessions", label: "Sessions" },
      { key: "runs", label: "Runs" },
      { key: "transport", label: "Transport" },
      { key: "transpSkis", label: "Transp. skis" },
      { key: "besWU", label: "Bes / WU" },
      { key: "startTime", label: "Start time" },
      { key: "start", label: "Start" },
      { key: "whoWhere", label: "Who / where?" },
      { key: "focus", label: "Focus" },
    ],
  },
  {
    title: "Timing & video",
    rows: [
      { key: "timingSL1", label: "Timing SL1" },
      { key: "timingSL2", label: "Timing SL2" },
      { key: "video", label: "Video" },
      { key: "radio", label: "Radio" },
    ],
  },
  {
    title: "Altro",
    rows: [
      { key: "storeRun", label: "Store-Run" },
      { key: "barmark", label: "Barmark" },
      { key: "skole", label: "Skole" },
      { key: "misc", label: "Misc" },
    ],
  },
];

const RACE_SECTIONS: Section[] = [
  {
    title: "Pasti & logistica",
    rows: [
      { key: "breakfast", label: "Breakfast" },
      { key: "lunch", label: "Lunch" },
      { key: "dinner", label: "Dinner" },
      { key: "transport", label: "Transport" },
      { key: "lifttickets", label: "Lifttickets" },
      { key: "packing", label: "Packing" },
      { key: "promo", label: "Promo" },
      { key: "departure", label: "Departure" },
      { key: "bibs", label: "BIBs" },
      { key: "lift", label: "Lift" },
      { key: "wUp", label: "W-Up" },
      { key: "coaches", label: "Coaches" },
      { key: "runW", label: "Run W" },
      { key: "athletes", label: "Athletes" },
      { key: "runM", label: "Run M" },
    ],
  },
  {
    title: "Inspection & start",
    rows: [
      { key: "besW1", label: "Bes W1" },
      { key: "besM1", label: "Bes M1" },
      { key: "startRun1", label: "Start run 1" },
      { key: "coachStart1", label: "Coach on start" },
      { key: "besW2", label: "Bes W2" },
      { key: "besM2", label: "Bes M2" },
      { key: "startRun2", label: "Start run 2" },
      { key: "coachStart2", label: "Coach on start (2)" },
      { key: "startInterval", label: "Start interval" },
      { key: "focus", label: "Focus" },
    ],
  },
  {
    title: "Comunicazione",
    rows: [
      { key: "finishradio", label: "Finish radio" },
      { key: "p1", label: "P1" },
      { key: "p2", label: "P2" },
      { key: "radio", label: "Radio" },
      { key: "rules", label: "Rules" },
      { key: "prizegiving", label: "Prize giving" },
      { key: "info", label: "Info" },
    ],
  },
];

export function programSections(kind: ProgramKind): Section[] {
  return kind === "race" ? RACE_SECTIONS : TRAINING_SECTIONS;
}

export function programKindLabel(kind: string): string {
  return kind === "race" ? "Gara" : "Allenamento";
}

export type LineupRow = { bib: string; athleteId?: string | null; name: string; goals: string };

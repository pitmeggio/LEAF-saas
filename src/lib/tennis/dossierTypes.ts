// Client-safe types + metadata for the Staff Dossier. No prisma here — the
// client StaffDossier imports CATEGORY_META and these types; the prisma read
// layer lives in ./dossier.ts.

export type DossierCategory = "evaluation" | "match_report" | "physical" | "medical" | "video" | "scouting" | "file";

export const CATEGORY_META: Record<DossierCategory, { label: string; color: string }> = {
  evaluation:   { label: "Scheda valutativa", color: "#22c55e" },
  match_report: { label: "Referto partita",   color: "#3b82f6" },
  physical:     { label: "Preparazione",      color: "#f59e0b" },
  medical:      { label: "Medico",            color: "#f87171" },
  video:        { label: "Video",             color: "#a78bfa" },
  scouting:     { label: "Scouting",          color: "#22d3ee" },
  file:         { label: "Documento",         color: "#94a3b8" },
};

export const CATEGORY_ORDER: DossierCategory[] = ["evaluation", "match_report", "physical", "video", "scouting", "medical", "file"];

export type DossierFile = {
  id: string;
  category: DossierCategory;
  title: string;
  note: string | null;
  authorName: string;
  authorRole: string | null;
  score: number | null;
  scoreScale: number | null;
  observedAt: string;  // ISO
  createdAt: string;   // ISO
  hasBinary: boolean;  // downloadable file stored in-app
  fileName: string | null;
  fileMime: string | null;
  fileSize: number | null;
  fileUrl: string | null;
};

export type EvalPoint = { date: string; value: number; scoreScale: number; title: string };

export type AthleteDossier = {
  files: DossierFile[];                 // newest first
  evaluationSeries: EvalPoint[];        // ascending by date, normalized to /10
  contributors: string[];               // distinct staff names
  countByCategory: Record<string, number>;
  total: number;
};

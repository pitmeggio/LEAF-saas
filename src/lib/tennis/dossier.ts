import { prisma } from "@/lib/db";
import type { AthleteDossier, DossierCategory, DossierFile, EvalPoint } from "./dossierTypes";

export type DossierActivity = {
  id: string; athleteId: string; athleteName: string;
  category: DossierCategory; title: string; authorName: string; authorRole: string | null;
  observedAt: string; createdAt: string; hasBinary: boolean; fileUrl: string | null;
};

export type DossierAthlete = {
  athleteId: string; name: string; fileCount: number; lastActivity: string | null; contributors: number;
};

export type AcademyDossierHub = {
  recent: DossierActivity[];
  athletes: DossierAthlete[];
  totalFiles: number;
  staff: string[]; // distinct contributors across the academy
};

// Cross-athlete staff portal. The "single place" everyone lands: what was
// added recently across the whole roster + every athlete's dossier at a glance.
export async function getAcademyDossierHub(academyId: string): Promise<AcademyDossierHub> {
  // Roster = athletes with a season plan in this academy (the tennis roster).
  const plans = await prisma.tennisSeasonPlan.findMany({
    where: { academyId },
    select: { athleteId: true, athlete: { select: { firstName: true } } },
    orderBy: { season: "desc" },
  });
  const nameById = new Map<string, string>();
  for (const p of plans) if (!nameById.has(p.athleteId)) nameById.set(p.athleteId, p.athlete.firstName);

  const files = await prisma.athleteFile.findMany({
    where: { academyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, athleteId: true, category: true, title: true, authorName: true, authorRole: true,
      observedAt: true, createdAt: true, fileName: true, fileUrl: true,
    },
  });

  const recent: DossierActivity[] = files.slice(0, 24).map((f) => ({
    id: f.id, athleteId: f.athleteId, athleteName: nameById.get(f.athleteId) ?? "Atleta",
    category: f.category as DossierCategory, title: f.title, authorName: f.authorName, authorRole: f.authorRole,
    observedAt: f.observedAt.toISOString(), createdAt: f.createdAt.toISOString(),
    hasBinary: !!f.fileName, fileUrl: f.fileUrl,
  }));

  const perAthlete = new Map<string, { count: number; last: Date | null; staff: Set<string> }>();
  const allStaff = new Set<string>();
  for (const f of files) {
    allStaff.add(f.authorName);
    const cur = perAthlete.get(f.athleteId) ?? { count: 0, last: null, staff: new Set<string>() };
    cur.count++;
    cur.staff.add(f.authorName);
    if (!cur.last || f.createdAt > cur.last) cur.last = f.createdAt;
    perAthlete.set(f.athleteId, cur);
  }

  const athletes: DossierAthlete[] = [...nameById.entries()]
    .map(([athleteId, name]) => {
      const a = perAthlete.get(athleteId);
      return { athleteId, name, fileCount: a?.count ?? 0, lastActivity: a?.last?.toISOString() ?? null, contributors: a?.staff.size ?? 0 };
    })
    .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "") || b.fileCount - a.fileCount || a.name.localeCompare(b.name));

  return { recent, athletes, totalFiles: files.length, staff: [...allStaff] };
}

// Server-only read layer for the Staff Dossier. Never selects fileData (the
// bytea blob) into a list — only metadata + whether a downloadable binary
// exists. Download goes through /api/athlete-files/[id]/file.
export async function getAthleteDossier(athleteId: string): Promise<AthleteDossier> {
  const rows = await prisma.athleteFile.findMany({
    where: { athleteId },
    orderBy: { observedAt: "desc" },
    select: {
      id: true, category: true, title: true, note: true,
      authorName: true, authorRole: true, score: true, scoreScale: true,
      observedAt: true, createdAt: true,
      fileName: true, fileMime: true, fileSize: true, fileUrl: true,
    },
  });

  const files: DossierFile[] = rows.map((r) => ({
    id: r.id,
    category: r.category as DossierCategory,
    title: r.title,
    note: r.note,
    authorName: r.authorName,
    authorRole: r.authorRole,
    score: r.score,
    scoreScale: r.scoreScale,
    observedAt: r.observedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    hasBinary: !!r.fileName,
    fileName: r.fileName,
    fileMime: r.fileMime,
    fileSize: r.fileSize,
    fileUrl: r.fileUrl,
  }));

  // Evaluation trend — any row carrying a score, normalized to /10, ascending.
  const evaluationSeries: EvalPoint[] = files
    .filter((f) => f.score != null)
    .map((f) => {
      const scale = f.scoreScale && f.scoreScale > 0 ? f.scoreScale : 10;
      return { date: f.observedAt, value: Math.round((f.score! / scale) * 100) / 10, scoreScale: scale, title: f.title };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const countByCategory: Record<string, number> = {};
  const contributors = new Set<string>();
  for (const f of files) {
    countByCategory[f.category] = (countByCategory[f.category] ?? 0) + 1;
    contributors.add(f.authorName);
  }

  return {
    files,
    evaluationSeries,
    contributors: [...contributors],
    countByCategory,
    total: files.length,
  };
}

import { prisma } from "@/lib/db";
import type { AthleteDossier, DossierCategory, DossierFile, EvalPoint } from "./dossierTypes";

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

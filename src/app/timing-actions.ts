"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession, requireAcademyId } from "@/lib/auth";

export type TimingImportRow = {
  athleteId: string;
  bib?: string | null;
  run1Ms?: number | null;
  run2Ms?: number | null;
  totalMs?: number | null;
  rank?: number | null;
};
export type TimingImportInput = {
  date: string; // yyyy-mm-dd
  kind: "training" | "race";
  discipline?: string | null;
  location?: string | null;
  source?: string | null;
  rows: TimingImportRow[];
};

const intOrNull = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;

export async function importTimingResults(
  input: TimingImportInput,
): Promise<{ ok: boolean; error?: string; count?: number; batchId?: string }> {
  const s = await getSession();
  if (!s?.academyId) return { ok: false, error: "Non autorizzato." };
  const academyId = await requireAcademyId();

  if (!input?.date) return { ok: false, error: "Data mancante." };
  const date = new Date(input.date);
  if (isNaN(date.getTime())) return { ok: false, error: "Data non valida." };

  const rows = (input.rows ?? []).filter((r) => r.athleteId);
  if (rows.length === 0) return { ok: false, error: "Nessuna riga abbinata a un atleta." };

  // Only keep athletes actually enrolled in THIS academy (tenant safety).
  const ids = [...new Set(rows.map((r) => r.athleteId))];
  const enrolled = await prisma.enrollment.findMany({
    where: { academyId, athleteId: { in: ids } },
    select: { athleteId: true },
  });
  const okIds = new Set(enrolled.map((e) => e.athleteId));
  const good = rows.filter((r) => okIds.has(r.athleteId));
  if (good.length === 0) return { ok: false, error: "Gli atleti abbinati non risultano in questa academy." };

  const batchId = randomUUID();
  const kind = input.kind === "race" ? "race" : "training";
  await prisma.timingResult.createMany({
    data: good.map((r) => ({
      academyId,
      athleteId: r.athleteId,
      date,
      kind,
      discipline: input.discipline?.trim() || null,
      location: input.location?.trim() || null,
      bib: r.bib?.toString().trim() || null,
      run1Ms: intOrNull(r.run1Ms),
      run2Ms: intOrNull(r.run2Ms),
      totalMs: intOrNull(r.totalMs),
      rank: intOrNull(r.rank),
      source: input.source?.trim() || "import",
      batchId,
    })),
  });

  revalidatePath("/dashboard/results");
  return { ok: true, count: good.length, batchId };
}

// Undo a whole imported session.
export async function deleteTimingBatch(batchId: string): Promise<{ ok: boolean; error?: string }> {
  const s = await getSession();
  if (!s?.academyId) return { ok: false, error: "Non autorizzato." };
  const academyId = await requireAcademyId();
  if (!batchId) return { ok: false, error: "Batch mancante." };
  await prisma.timingResult.deleteMany({ where: { academyId, batchId } });
  revalidatePath("/dashboard/results");
  return { ok: true };
}

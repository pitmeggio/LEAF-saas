"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession, requireAcademyId } from "@/lib/auth";

export type TimingImportRun = {
  athleteId: string;
  bib?: string | null;
  runNumber?: number | null;
  finishMs?: number | null;
  splitsMs?: number[];
  status?: string | null;
};
export type TimingImportInput = {
  date: string; // yyyy-mm-dd
  kind: "training" | "race";
  discipline?: string | null;
  location?: string | null;
  sessionLabel?: string | null;
  source?: string | null;
  runs: TimingImportRun[];
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

  const runs = (input.runs ?? []).filter((r) => r.athleteId);
  if (runs.length === 0) return { ok: false, error: "Nessuna riga abbinata a un atleta." };

  // Tenant safety — only athletes enrolled in THIS academy.
  const ids = [...new Set(runs.map((r) => r.athleteId))];
  const enrolled = await prisma.enrollment.findMany({
    where: { academyId, athleteId: { in: ids } },
    select: { athleteId: true },
  });
  const okIds = new Set(enrolled.map((e) => e.athleteId));
  const good = runs.filter((r) => okIds.has(r.athleteId));
  if (good.length === 0) return { ok: false, error: "Gli atleti abbinati non risultano in questa academy." };

  const batchId = randomUUID();
  const kind = input.kind === "race" ? "race" : "training";
  await prisma.timingResult.createMany({
    data: good.map((r) => ({
      academyId,
      athleteId: r.athleteId,
      batchId,
      date,
      kind,
      discipline: input.discipline?.trim() || null,
      location: input.location?.trim() || null,
      sessionLabel: input.sessionLabel?.trim() || null,
      bib: r.bib?.toString().trim() || null,
      runNumber: intOrNull(r.runNumber),
      finishMs: intOrNull(r.finishMs),
      splitsMs: (r.splitsMs ?? []).map((x) => Math.round(x)).filter((x) => Number.isFinite(x) && x > 0),
      status: r.status?.trim() || null,
      source: input.source?.trim() || "import",
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

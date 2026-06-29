"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { firstError } from "@/lib/validation";

type Result = { ok: true; id?: string } | { ok: false; error: string };

const CATEGORIES = ["evaluation", "match_report", "physical", "medical", "video", "scouting", "file"] as const;

async function ownsAthlete(athleteId: string, academyId: string) {
  return prisma.athlete.findFirst({
    where: { id: athleteId, OR: [{ tennisSeasonPlans: { some: { academyId } } }, { enrollments: { some: { academyId } } }] },
    select: { id: true },
  });
}

// A dossier entry WITHOUT an uploaded binary: a pasted link (Drive/YouTube),
// or a pure evaluation score, or a written observation. The file-upload path
// is the route handler /api/athlete-files/upload.
const entrySchema = z.object({
  athleteId: z.string().min(1),
  category: z.enum(CATEGORIES),
  title: z.string().trim().min(1).max(140),
  note: z.string().trim().max(2000).nullish().transform((v) => v || null),
  authorRole: z.string().trim().max(40).nullish().transform((v) => v || null),
  observedAt: z.string().min(1),
  score: z.coerce.number().min(0).max(100000).nullish(),
  scoreScale: z.coerce.number().int().min(1).max(1000).nullish(),
  fileUrl: z.string().trim().url().max(500).nullish().or(z.literal("")).transform((v) => (v ? v : null)),
});

export async function addAthleteEntry(input: z.input<typeof entrySchema>): Promise<Result> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const s = await getSession();
  if (!s || !s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  if (!(await ownsAthlete(d.athleteId, s.academyId))) return { ok: false, error: "Atleta non trovato." };

  if (d.score == null && !d.fileUrl && !d.note) {
    return { ok: false, error: "Aggiungi un punteggio, un link o una nota." };
  }
  const date = new Date(d.observedAt);
  if (isNaN(date.getTime())) return { ok: false, error: "Data non valida." };

  const created = await prisma.athleteFile.create({
    data: {
      academyId: s.academyId, athleteId: d.athleteId,
      authorId: s.userId, authorName: s.name, authorRole: d.authorRole,
      category: d.category, title: d.title, note: d.note,
      score: d.score ?? null,
      scoreScale: d.score != null ? (d.scoreScale ?? 10) : null,
      observedAt: date,
      fileUrl: d.fileUrl,
    },
    select: { id: true },
  });

  revalidatePath(`/dashboard/canvas/${d.athleteId}`);
  return { ok: true, id: created.id };
}

export async function deleteAthleteFile(id: string): Promise<{ ok: boolean }> {
  const s = await getSession();
  if (!s || !s.academyId) return { ok: false };
  const row = await prisma.athleteFile.findFirst({ where: { id, academyId: s.academyId }, select: { id: true, athleteId: true } });
  if (!row) return { ok: false };
  await prisma.athleteFile.delete({ where: { id: row.id } });
  revalidatePath(`/dashboard/canvas/${row.athleteId}`);
  return { ok: true };
}

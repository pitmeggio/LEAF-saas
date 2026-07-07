"use server";

// Anagrafica athlete edits — Codice Fiscale + federation membership (tessera FIT
// / iPin ITF) with renewal deadlines that feed the scadenza alerts. Writable by
// admin OR office (segreteria). Tenant-scoped: the athlete must belong to the
// staff member's academy (via enrollment OR tennis season plan) before any write.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBackOffice } from "@/lib/auth";
import { firstError } from "@/lib/validation";

type Result = { ok: true } | { ok: false; error: string };

async function ownsAthlete(academyId: string, athleteId: string): Promise<boolean> {
  const [plan, enr] = await Promise.all([
    prisma.tennisSeasonPlan.findFirst({ where: { athleteId, academyId }, select: { id: true } }),
    prisma.enrollment.findFirst({ where: { athleteId, academyId }, select: { id: true } }),
  ]);
  return !!(plan || enr);
}

// Empty string → null; "YYYY-MM-DD" → Date. Keeps optional date inputs clean.
const optDate = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v && v.length ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}/.test(v), { message: "Data non valida." });

const schema = z.object({
  athleteId: z.string().min(1),
  codiceFiscale: z.string().trim().max(16).nullish().transform((v) => (v ? v.toUpperCase() : null)),
  fitTessera: z.string().trim().max(40).nullish().transform((v) => v || null),
  fitTesseraExpiry: optDate,
  itfJuniorRef: z.string().trim().max(40).nullish().transform((v) => v || null),
  ipinExpiry: optDate,
});

export async function updateAthleteAnagrafica(input: z.input<typeof schema>): Promise<Result> {
  const s = await requireBackOffice();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  if (!(await ownsAthlete(s.academyId, d.athleteId))) return { ok: false, error: "Atleta non trovato." };

  await prisma.athlete.update({
    where: { id: d.athleteId },
    data: {
      codiceFiscale: d.codiceFiscale,
      fitTessera: d.fitTessera,
      fitTesseraExpiry: d.fitTesseraExpiry ? new Date(d.fitTesseraExpiry) : null,
      itfJuniorRef: d.itfJuniorRef,
      ipinExpiry: d.ipinExpiry ? new Date(d.ipinExpiry) : null,
    },
  });

  revalidatePath(`/dashboard/canvas/${d.athleteId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

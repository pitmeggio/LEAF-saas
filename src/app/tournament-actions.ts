"use server";

// LEAF OS Professional Tennis — tournament catalogue + season-plan actions.
// Admin-only, tenant-scoped, audit-safe. The Excel import re-uses the same
// parser the seed script uses, so behaviour stays consistent.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { firstError } from "@/lib/validation";
import { parseTournamentCalendar, deriveCatalogue } from "@/lib/tournamentImport";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

function rev() {
  revalidatePath("/dashboard/tournaments");
  revalidatePath("/dashboard/season");
  revalidatePath("/dashboard/canvas");
}

const tournamentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(20),
  location: z.string().trim().max(120).nullish().transform((v) => v ?? null),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  ageGroup: z.string().trim().max(20).nullish().transform((v) => v ?? null),
  surface: z.string().trim().max(20).nullish().transform((v) => v ?? null),
  pointsPotential: z.coerce.number().int().min(0).nullish(),
  externalUrl: z.string().trim().max(300).nullish().transform((v) => v ?? null),
  notes: z.string().trim().max(500).nullish().transform((v) => v ?? null),
});

export async function createTournament(input: z.input<typeof tournamentSchema>): Promise<Result<{ id: string }>> {
  const parsed = tournamentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const d = parsed.data;
  const created = await prisma.tennisTournament.create({
    data: {
      academyId: s.academyId,
      name: d.name,
      category: d.category,
      location: d.location,
      startDate: new Date(d.startDate),
      endDate: new Date(d.endDate),
      ageGroup: d.ageGroup,
      surface: d.surface,
      pointsPotential: d.pointsPotential ?? null,
      externalUrl: d.externalUrl,
      notes: d.notes,
    },
  });
  rev();
  return { ok: true, data: { id: created.id } };
}

export async function deleteTournament(id: string): Promise<Result> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const existing = await prisma.tennisTournament.findFirst({ where: { id, academyId: s.academyId }, select: { id: true } });
  if (!existing) return { ok: false, error: "Tournament not found." };
  await prisma.tennisTournament.delete({ where: { id } });
  rev();
  return { ok: true };
}

// Excel import — Max's CALENDARI TORNEI format. Wipes prior import for
// this academy then re-imports cleanly (catalogue + per-athlete plans).
const importSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2099),
});

export async function importTournamentCalendar(form: FormData): Promise<Result<{
  catalogue: number;
  plans: number;
  entries: number;
  athletesMissing: string[];   // sheet names with no matching athlete in DB
  warnings: string[];
}>> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const parsedInput = importSchema.safeParse({ year: form.get("year") });
  if (!parsedInput.success) return { ok: false, error: firstError(parsedInput.error) };

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Missing file." };
  if (file.size > 3 * 1024 * 1024) return { ok: false, error: "File too large (max 3 MB)." };

  const buf = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseTournamentCalendar(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), { year: parsedInput.data.year });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not parse file." };
  }
  if (parsed.plans.length === 0) {
    return { ok: false, error: parsed.warnings[0] ?? "No athlete plans found in the file." };
  }

  // Match sheet displayName → existing Athlete in this academy (by firstName, case-insensitive).
  const academyAthletes = await prisma.athlete.findMany({
    where: { sport: "tennis", enrollments: { some: { academyId: s.academyId } } },
    select: { id: true, firstName: true },
  });
  // Also include athletes via TennisSeasonPlan (covers seed-created ones).
  const planAthletes = await prisma.athlete.findMany({
    where: { tennisSeasonPlans: { some: { academyId: s.academyId } } },
    select: { id: true, firstName: true },
  });
  const byFirstName = new Map<string, string>();
  for (const a of [...academyAthletes, ...planAthletes]) byFirstName.set(a.firstName.toLowerCase(), a.id);

  // Wipe old plans/entries/catalogue for this academy then recreate clean.
  await prisma.tennisSeasonPlanEntry.deleteMany({ where: { plan: { academyId: s.academyId } } });
  await prisma.tennisSeasonPlan.deleteMany({ where: { academyId: s.academyId } });
  await prisma.tennisTournament.deleteMany({ where: { academyId: s.academyId } });

  const { catalogue, byKey } = deriveCatalogue(parsed.plans);
  const idByKey = new Map<string, string>();
  for (const c of catalogue) {
    const created = await prisma.tennisTournament.create({
      data: {
        academyId: s.academyId,
        name: c.name,
        category: c.category,
        location: c.location,
        startDate: c.startDate,
        endDate: c.endDate,
      },
    });
    idByKey.set(c.key, created.id);
  }

  const athletesMissing: string[] = [];
  let plansCreated = 0;
  let entriesCreated = 0;

  for (const plan of parsed.plans) {
    const athleteId = byFirstName.get(plan.athleteDisplayName.toLowerCase());
    if (!athleteId) {
      athletesMissing.push(plan.athleteDisplayName);
      continue;
    }
    const planRow = await prisma.tennisSeasonPlan.create({
      data: {
        academyId: s.academyId,
        athleteId,
        season: String(parsedInput.data.year),
        columns: plan.columns,
      },
    });
    plansCreated++;
    for (const e of plan.entries) {
      if (!e.weekStart) continue;
      const dedupeKey = e.parsedName ? `${e.parsedName.toLowerCase()}|${e.weekStart.toISOString().slice(0, 10)}|${e.columnKey}` : "";
      const tournamentId = idByKey.get(dedupeKey) ?? null;
      await prisma.tennisSeasonPlanEntry.create({
        data: {
          planId: planRow.id,
          weekStart: e.weekStart,
          trainingPhase: e.trainingPhase,
          columnKey: e.columnKey,
          tournamentId,
          freeText: tournamentId ? null : e.text,
          notes: e.parsedDateRange ? `Range: ${e.parsedDateRange}` : null,
        },
      });
      entriesCreated++;
    }
  }

  rev();
  return {
    ok: true,
    data: {
      catalogue: catalogue.length,
      plans: plansCreated,
      entries: entriesCreated,
      athletesMissing,
      warnings: parsed.warnings,
    },
  };
}

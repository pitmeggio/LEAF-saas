"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAthleteId } from "@/lib/auth";
import { firstError } from "@/lib/validation";
import { computeReadiness } from "@/lib/wellnessCore";

type Result = { ok: true; readiness: number } | { ok: false; error: string };

const schema = z.object({
  sleepQuality: z.coerce.number().int().min(1).max(5),
  soreness: z.coerce.number().int().min(1).max(5),
  energy: z.coerce.number().int().min(1).max(5),
  mood: z.coerce.number().int().min(1).max(5),
  stress: z.coerce.number().int().min(1).max(5),
  sleepHours: z.coerce.number().min(0).max(24).nullish(),
  note: z.string().trim().max(500).nullish().transform((v) => v || null),
});

function todayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Resolve the athlete's academy (enrollment first, then tennis season plan).
async function academyForAthlete(athleteId: string): Promise<string | null> {
  const enr = await prisma.enrollment.findFirst({ where: { athleteId }, select: { academyId: true } });
  if (enr) return enr.academyId;
  const plan = await prisma.tennisSeasonPlan.findFirst({ where: { athleteId }, select: { academyId: true } });
  return plan?.academyId ?? null;
}

// The athlete's daily check-in. Upserts today's row (one per athlete per day)
// and stamps the derived readiness.
export async function submitCheckin(input: z.input<typeof schema>): Promise<Result> {
  const athleteId = await requireAthleteId();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const academyId = await academyForAthlete(athleteId);
  if (!academyId) return { ok: false, error: "Atleta non collegato a un'academy." };

  const readiness = computeReadiness(d);
  const date = todayUTC();
  const data = {
    sleepQuality: d.sleepQuality, soreness: d.soreness, energy: d.energy, mood: d.mood, stress: d.stress,
    sleepHours: d.sleepHours ?? null, note: d.note, readiness,
  };

  await prisma.wellnessCheckin.upsert({
    where: { athleteId_date: { athleteId, date } },
    update: data,
    create: { academyId, athleteId, date, ...data },
  });

  revalidatePath("/app");
  revalidatePath("/app/wellness");
  return { ok: true, readiness };
}

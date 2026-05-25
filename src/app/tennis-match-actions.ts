"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession, requireAcademyId } from "@/lib/auth";
import {
  tennisMatchCreateSchema,
  tennisMatchDeleteSchema,
  firstError,
  type TennisMatchCreateInput,
  type TennisMatchDeleteInput,
} from "@/lib/validation";

type Result = { ok: true; id?: string } | { ok: false; error: string };

// Create a tennis match record. Coach scoping mirrors createCoachNote — a
// coach can log matches for athletes they actually coach; admin bypass.
export async function createTennisMatch(input: TennisMatchCreateInput): Promise<Result> {
  const parsed = tennisMatchCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const academyId = await requireAcademyId();

  const athlete = await prisma.athlete.findFirst({
    where: { id: d.athleteId, enrollments: { some: { academyId } } },
    select: { id: true },
  });
  if (!athlete) return { ok: false, error: "Athlete not in this academy." };

  if (!session.isAdmin) {
    const ownsEnrollment = await prisma.enrollment.count({
      where: { athleteId: d.athleteId, academyId, OR: [{ coachId: session.coachId ?? undefined }, { group: { coachId: session.coachId ?? undefined } }] },
    });
    if (ownsEnrollment === 0) return { ok: false, error: "You can only log matches for athletes you coach." };
  }

  const date = new Date(d.date);
  if (isNaN(date.getTime())) return { ok: false, error: "Invalid date." };

  const created = await prisma.tennisMatch.create({
    data: {
      academyId,
      athleteId: d.athleteId,
      date,
      opponent: d.opponent,
      result: d.result,
      score: d.score ?? null,
      surface: d.surface,
      notes: d.notes ?? null,
    },
  });
  revalidatePath(`/dashboard/athletes`);
  return { ok: true, id: created.id };
}

export async function deleteTennisMatch(input: TennisMatchDeleteInput): Promise<Result> {
  const parsed = tennisMatchDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const academyId = await requireAcademyId();
  const match = await prisma.tennisMatch.findFirst({ where: { id: parsed.data.id, academyId } });
  if (!match) return { ok: false, error: "Match not found." };
  if (!session.isAdmin) {
    const ownsEnrollment = await prisma.enrollment.count({
      where: { athleteId: match.athleteId, academyId, OR: [{ coachId: session.coachId ?? undefined }, { group: { coachId: session.coachId ?? undefined } }] },
    });
    if (ownsEnrollment === 0) return { ok: false, error: "Only the athlete's coach or an admin can delete this match." };
  }
  await prisma.tennisMatch.delete({ where: { id: match.id } });
  revalidatePath(`/dashboard/athletes`);
  return { ok: true };
}

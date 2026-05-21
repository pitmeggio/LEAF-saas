"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAcademyId } from "@/lib/auth";
import { sessionCreateSchema, attendanceSaveSchema, firstError } from "@/lib/validation";

export type Result = { ok: boolean; error?: string; id?: string };

// Create a training session for a group on a date (scoped to the academy).
export async function createSession(input: unknown): Promise<Result> {
  const academyId = await requireAcademyId();
  const parsed = sessionCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { groupId, date, title } = parsed.data;

  const group = await prisma.group.findFirst({ where: { id: groupId, academyId } });
  if (!group) return { ok: false, error: "Group not found." };

  const session = await prisma.trainingSession.create({
    data: { academyId, groupId, date: new Date(date), title: title ?? null, coachId: group.coachId },
  });
  revalidatePath("/dashboard/attendance");
  return { ok: true, id: session.id };
}

// Save attendance for a session — upserts one record per athlete.
export async function saveAttendance(input: unknown): Promise<Result> {
  const academyId = await requireAcademyId();
  const parsed = attendanceSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { sessionId, entries } = parsed.data;

  const session = await prisma.trainingSession.findFirst({ where: { id: sessionId, academyId } });
  if (!session) return { ok: false, error: "Session not found." };

  await prisma.$transaction(
    entries.map((e) =>
      prisma.attendance.upsert({
        where: { sessionId_enrollmentId: { sessionId, enrollmentId: e.enrollmentId } },
        create: { sessionId, enrollmentId: e.enrollmentId, status: e.status, note: e.note ?? null },
        update: { status: e.status, note: e.note ?? null },
      }),
    ),
  );
  revalidatePath("/dashboard/attendance");
  return { ok: true, id: sessionId };
}

export async function deleteSession(id: string): Promise<Result> {
  const academyId = await requireAcademyId();
  const session = await prisma.trainingSession.findFirst({ where: { id, academyId } });
  if (!session) return { ok: false, error: "Session not found." };
  await prisma.trainingSession.delete({ where: { id } });
  revalidatePath("/dashboard/attendance");
  return { ok: true };
}

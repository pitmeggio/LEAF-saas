"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSession, requireAcademyId } from "@/lib/auth";
import {
  coachNoteCreateSchema,
  coachNoteDeleteSchema,
  firstError,
  type CoachNoteCreateInput,
  type CoachNoteDeleteInput,
} from "@/lib/validation";
import { structureCoachNote } from "@/lib/ai/coachNotes";
import { mergeNoteIntoProfile, type AthleteAiProfile } from "@/lib/ai/coachProfile";
import { mergeCoachStyle, coachStyleHint, type CoachAiStyle } from "@/lib/ai/coachStyle";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

// Create a new coach note. Runs the structurer inline, persists the raw text
// + structured analysis + attachment refs, then folds the result into the
// athlete's living aiProfile. Coach + admin can author; coach is scoped to
// athletes they actually coach via the resolveCoachId guard below.
export async function createCoachNote(input: CoachNoteCreateInput): Promise<Result> {
  const parsed = coachNoteCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const academyId = await requireAcademyId();

  // Sport snapshot — read from the athlete's most recent group (the group of
  // their active enrollment if any). Falls back to the athlete's own sport.
  const athlete = await prisma.athlete.findFirst({
    where: { id: d.athleteId, enrollments: { some: { academyId } } },
    include: {
      enrollments: {
        where: { academyId },
        orderBy: { joinDate: "desc" },
        include: { group: { select: { sport: true, coachId: true } } },
        take: 1,
      },
    },
  });
  if (!athlete) return { ok: false, error: "Athlete not found in this academy." };

  // Coach scoping — if the user is a coach (not admin), they can only annotate
  // athletes whose current group they coach. Admin bypass.
  const enr = athlete.enrollments[0];
  const coachId = session.coachId ?? null;
  if (!session.isAdmin) {
    const ownsGroup = enr?.group?.coachId === coachId;
    const ownsEnrollment = enr ? await prisma.enrollment.count({
      where: { athleteId: d.athleteId, academyId, coachId: coachId ?? undefined },
    }) > 0 : false;
    if (!ownsGroup && !ownsEnrollment) {
      return { ok: false, error: "You can only add notes for athletes you coach." };
    }
  }

  const sport = enr?.group?.sport ?? athlete.sport ?? "ski";

  // Persist as pending first — durability beats latency. Even if the AI call
  // explodes, the coach's words are saved.
  const created = await prisma.coachNote.create({
    data: {
      academyId,
      athleteId: d.athleteId,
      coachId: coachId,
      authorId: session.userId,
      rawText: d.rawText,
      sport,
      kind: d.kind ?? null,
      status: "pending",
      attachments: d.attachments && d.attachments.length > 0 ? {
        create: d.attachments.map((a) => ({
          filename: a.filename,
          url: a.url,
          mimeType: a.mimeType ?? "application/octet-stream",
          size: a.size ?? 0,
        })),
      } : undefined,
    },
  });

  // Load the coach's living style so the LLM gets a personalisation hint
  // ("this coach tends to focus on X / Y"). Hint stays empty for the first
  // few notes (low-signal guard inside coachStyleHint).
  const coachRecord = coachId
    ? await prisma.coach.findUnique({ where: { id: coachId }, select: { aiStyle: true } })
    : null;
  const prevStyle = (coachRecord?.aiStyle as unknown as CoachAiStyle | null) ?? null;

  // Structure + merge — inline for the MVP (single request flow). Failures
  // are non-fatal: the note keeps its raw text and the UI surfaces an error.
  try {
    const structured = await structureCoachNote({
      rawText: d.rawText,
      sport,
      kindHint: d.kind ?? null,
      coachLensHint: coachStyleHint(prevStyle) || null,
    });
    await prisma.coachNote.update({
      where: { id: created.id },
      data: {
        aiSummary: structured as unknown as Prisma.InputJsonValue,
        engine: structured.engine,
        status: "structured",
        kind: structured.detectedKind ?? d.kind ?? null,
      },
    });

    // Update the athlete's living profile.
    const prevProfile = athlete.aiProfile as unknown as AthleteAiProfile | null;
    const nextProfile = mergeNoteIntoProfile(prevProfile, structured);
    await prisma.athlete.update({
      where: { id: d.athleteId },
      data: {
        aiProfile: nextProfile as unknown as Prisma.InputJsonValue,
        aiProfileUpdatedAt: new Date(),
      },
    });

    // Update the coach's own aiStyle so the next note carries a sharper lens.
    if (coachId) {
      const nextStyle = mergeCoachStyle(prevStyle, structured, d.rawText);
      await prisma.coach.update({
        where: { id: coachId },
        data: {
          aiStyle: nextStyle as unknown as Prisma.InputJsonValue,
          aiStyleUpdatedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.error("[coach-notes] structurer failed", err);
    await prisma.coachNote.update({
      where: { id: created.id },
      data: { status: "failed", error: err instanceof Error ? err.message : "unknown" },
    });
  }

  // Members detail page reads the note list + AI profile; coach dashboard
  // surfaces the latest activity.
  revalidatePath(`/dashboard/athletes/${enr?.id ?? ""}`);
  revalidatePath(`/dashboard`);
  return { ok: true, id: created.id };
}

// Delete a coach note. Author or admin only. We do not recompute aiProfile
// retroactively (it's a rolling counter): a Recompute action can be added
// later if needed.
export async function deleteCoachNote(input: CoachNoteDeleteInput): Promise<Result> {
  const parsed = coachNoteDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const academyId = await requireAcademyId();

  const note = await prisma.coachNote.findFirst({
    where: { id: parsed.data.id, academyId },
  });
  if (!note) return { ok: false, error: "Note not found." };
  const isAuthor = note.authorId === session.userId;
  if (!session.isAdmin && !isAuthor) return { ok: false, error: "Only the author or an admin can delete this note." };

  await prisma.coachNote.delete({ where: { id: note.id } });

  // Best-effort revalidation — we don't have the enrollment id at hand.
  revalidatePath(`/dashboard/athletes`);
  revalidatePath(`/dashboard`);
  return { ok: true };
}

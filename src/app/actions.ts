"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser, requireAcademyId } from "@/lib/auth";
import { moveApplicationSchema, addNoteSchema } from "@/lib/validation";
import { enrollAcceptedApplication } from "@/lib/enrollment";
import { notify } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

export async function moveApplication(applicationId: string, to: string) {
  const parsed = moveApplicationSchema.safeParse({ applicationId, to });
  if (!parsed.success) return;

  const academyId = await requireAcademyId();
  // Scope to the active academy so a coach can only move their own applications.
  const current = await prisma.application.findFirst({
    where: { id: parsed.data.applicationId, academyId },
  });
  if (!current || current.status === parsed.data.to) return;

  await prisma.application.update({ where: { id: current.id }, data: { status: parsed.data.to } });
  await prisma.statusEvent.create({ data: { applicationId: current.id, from: current.status, to: parsed.data.to } });

  // Automation: accepting an application enrolls the athlete (creates the active
  // athlete, payment schedule and required-document checklist + sends emails).
  if (parsed.data.to === "accepted") {
    await enrollAcceptedApplication(current.id);
    revalidatePath("/members");
    revalidatePath("/payments");
    revalidatePath("/documents");
  } else if (parsed.data.to === "rejected") {
    const app = await prisma.application.findUnique({ where: { id: current.id }, include: { athlete: true, academy: true } });
    if (app) {
      await notify({ academyId: app.academyId, type: "application_rejected", toEmail: app.athlete.email, toName: `${app.athlete.firstName} ${app.athlete.lastName}`, applicationId: app.id, ctx: { academyName: app.academy.name, athleteName: `${app.athlete.firstName} ${app.athlete.lastName}` } });
    }
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${current.id}`);
  revalidatePath("/");
}

export async function addNote(applicationId: string, body: string) {
  const parsed = addNoteSchema.safeParse({ applicationId, body });
  if (!parsed.success) return;

  const user = await getCurrentUser();
  await prisma.note.create({
    data: { applicationId: parsed.data.applicationId, body: parsed.data.body, authorId: user?.id ?? null },
  });
  revalidatePath(`/applications/${parsed.data.applicationId}`);
}

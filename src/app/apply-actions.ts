"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { importAthleteByFisCode } from "@/lib/fis/import";
import { colorForCode } from "@/lib/fis/simulatedProvider";
import { applicationSchema, firstError } from "@/lib/validation";
import { notify } from "@/lib/notifications";
import { requireAthleteId } from "@/lib/auth";

export type ApplyState = { error?: string };

export async function submitApplicationAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const parsed = applicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  const academy = await prisma.academy.findUnique({ where: { slug: d.slug } });
  if (!academy) return { error: "Academy not found." };

  // Validate package belongs to this academy.
  let validPackageId: string | null = null;
  if (d.packageId) {
    const pkg = await prisma.package.findFirst({ where: { id: d.packageId, academyId: academy.id } });
    validPackageId = pkg?.id ?? null;
  }

  // Validate opportunity belongs to this academy and is published.
  let validOpportunityId: string | null = null;
  if (d.opportunityId) {
    const opp = await prisma.opportunity.findFirst({ where: { id: d.opportunityId, academyId: academy.id, status: "published" } });
    validOpportunityId = opp?.id ?? null;
  }

  const dob = d.dob ? new Date(d.dob) : null;
  let athleteId: string;

  if (d.fisCode) {
    // FIS path — dedups by fisCode via upsert inside the import service.
    const imported = await importAthleteByFisCode(d.fisCode);
    if (!imported) return { error: `No FIS record found for "${d.fisCode}". Remove it or correct the code.` };
    athleteId = imported.athleteId;
    await prisma.athlete.update({ where: { id: athleteId }, data: { email: d.email } });
  } else {
    // Manual path — dedup by email.
    const existing = await prisma.athlete.findFirst({ where: { email: d.email } });
    if (existing) {
      athleteId = existing.id;
      await prisma.athlete.update({
        where: { id: existing.id },
        data: {
          firstName: d.firstName,
          lastName: d.lastName,
          ...(dob ? { dob } : {}),
          nationality: d.nationality!,
          sport: d.sport,
          discipline: d.discipline!,
        },
      });
    } else {
      const athlete = await prisma.athlete.create({
        data: {
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email,
          dob: dob ?? new Date(),
          nationality: d.nationality!,
          sport: d.sport,
          discipline: d.discipline!,
          fisPoints: null,
          worldRank: null,
          verified: false,
          photoColor: colorForCode(`${d.firstName}${d.lastName}${d.email}`),
          location: d.nationality!,
        },
      });
      athleteId = athlete.id;
    }
  }

  if (d.mediaLink) {
    await prisma.media.create({ data: { athleteId, type: "video", title: "Applicant video", duration: null } });
  }

  const application = await prisma.application.create({
    data: {
      academyId: academy.id,
      athleteId,
      packageId: validPackageId,
      opportunityId: validOpportunityId,
      status: "new",
      source: "public_form",
      sport: d.sport,
      message: d.motivation ?? null,
      currentRanking: d.currentRanking ?? null,
      previousClub: d.previousClub ?? null,
      guardianName: d.guardianName ?? null,
      guardianContact: d.guardianContact ?? null,
      mediaLink: d.mediaLink ?? null,
    },
  });
  await prisma.statusEvent.create({ data: { applicationId: application.id, from: null, to: "new" } });

  // Open a communication thread for the application (follows the athlete on enrollment).
  const conversation = await prisma.conversation.create({
    data: {
      academyId: academy.id,
      type: "application",
      applicationId: application.id,
      athleteId,
      subject: `${d.firstName} ${d.lastName} — application`,
      status: "open",
      lastMessagePreview: "Application received",
    },
  });
  await prisma.message.create({
    data: { conversationId: conversation.id, senderSide: "system", senderRole: "system", senderName: "System", body: `Application received. The coaching staff will review it and reply here.` },
  });

  // Automatic "thanks for applying" email.
  const pkg = validPackageId ? await prisma.package.findUnique({ where: { id: validPackageId } }) : null;
  await notify({
    academyId: academy.id,
    type: "thanks_for_applying",
    toEmail: d.email,
    toName: `${d.firstName} ${d.lastName}`,
    applicationId: application.id,
    ctx: { academyName: academy.name, athleteName: `${d.firstName} ${d.lastName}`, packageName: pkg?.name ?? null },
  });

  revalidatePath("/applications");
  revalidatePath("/");
  redirect(`/academy/${d.slug}/thanks?c=${conversation.id}`);
}

// One-click "Apply with LEAF" for a signed-in athlete — files an application to
// the academy using their existing verified profile. No form, no re-typing; the
// application lands in the academy portal already enriched (the dashboard then
// computes fit score + smart group suggestion from the verified data).
export async function applyWithMyProfile(formData: FormData): Promise<void> {
  const athleteId = await requireAthleteId();
  const slug = String(formData.get("slug") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "") || null;

  const academy = await prisma.academy.findUnique({ where: { slug } });
  if (!academy) redirect(`/academy/${slug}`);

  const athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
  if (!athlete) redirect("/me");

  // Don't double-apply: reuse the open conversation if one already exists.
  const existing = await prisma.application.findFirst({
    where: { academyId: academy!.id, athleteId },
    include: { conversation: { select: { id: true } } },
    orderBy: { submittedAt: "desc" },
  });
  if (existing) {
    if (existing.conversation) redirect(`/academy/${slug}/thanks?c=${existing.conversation.id}`);
    redirect(`/academy/${slug}/thanks`);
  }

  let validOpportunityId: string | null = null;
  if (opportunityId) {
    const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, academyId: academy!.id, status: "published" } });
    validOpportunityId = opp?.id ?? null;
  }

  const application = await prisma.application.create({
    data: {
      academyId: academy!.id,
      athleteId,
      opportunityId: validOpportunityId,
      status: "new",
      source: "leaf_profile",
      sport: athlete!.sport,
    },
  });
  await prisma.statusEvent.create({ data: { applicationId: application.id, from: null, to: "new" } });

  const conversation = await prisma.conversation.create({
    data: {
      academyId: academy!.id,
      type: "application",
      applicationId: application.id,
      athleteId,
      subject: `${athlete!.firstName} ${athlete!.lastName} — application (LEAF)`,
      status: "open",
      lastMessagePreview: "Application received via LEAF profile",
    },
  });
  await prisma.message.create({
    data: { conversationId: conversation.id, senderSide: "system", senderRole: "system", senderName: "System", body: "Application received via verified LEAF profile. The coaching staff will review it and reply here." },
  });

  if (athlete!.email) {
    await notify({
      academyId: academy!.id,
      type: "thanks_for_applying",
      toEmail: athlete!.email,
      toName: `${athlete!.firstName} ${athlete!.lastName}`,
      applicationId: application.id,
      ctx: { academyName: academy!.name, athleteName: `${athlete!.firstName} ${athlete!.lastName}`, packageName: null },
    });
  }

  revalidatePath("/dashboard/applications");
  redirect(`/academy/${slug}/thanks?c=${conversation.id}`);
}

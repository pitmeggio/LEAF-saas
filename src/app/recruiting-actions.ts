"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { recruitingSettingsSchema, firstError, type RecruitingSettingsInput } from "@/lib/validation";
import { resolveApplicationFields, toApplicationConfig } from "@/lib/applicationForm";

export type Result = { ok: boolean; error?: string };

// Persist the academy's config-driven application form. Untrusted input is run
// through resolveApplicationFields, which sanitizes every entry, drops unsafe
// custom keys and force-enables locked identity fields — so a malformed payload
// can never break athlete creation. Academy-admin only, tenant-scoped.
export async function updateApplicationForm(fields: unknown): Promise<Result> {
  const session = await requireAdmin();
  const academyId = session.academyId;
  if (!academyId) return { ok: false, error: "No academy in session." };

  const list = Array.isArray(fields) ? fields.slice(0, 50) : [];
  const resolved = resolveApplicationFields({ fields: list });
  await prisma.academy.update({
    where: { id: academyId },
    data: { applicationConfig: toApplicationConfig(resolved) as unknown as Prisma.InputJsonValue },
  });

  revalidatePath("/dashboard/recruiting");
  return { ok: true };
}

// Update the current academy's public recruiting settings. Academy-admin only and
// tenant-scoped: writes only to the caller's own academy (requireAdmin resolves it).
export async function updateRecruitingSettings(input: RecruitingSettingsInput): Promise<Result> {
  const parsed = recruitingSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const session = await requireAdmin();
  const academyId = session.academyId;
  if (!academyId) return { ok: false, error: "No academy in session." };

  let deadline: Date | null = null;
  if (d.applicationDeadline) {
    const parsedDate = new Date(d.applicationDeadline);
    if (isNaN(parsedDate.getTime())) return { ok: false, error: "Invalid application deadline." };
    deadline = parsedDate;
  }

  await prisma.academy.update({
    where: { id: academyId },
    data: {
      recruitingEnabled: d.recruitingEnabled,
      recruitingStatus: d.recruitingStatus,
      publicRecruitingHeadline: d.publicRecruitingHeadline ?? null,
      publicRecruitingDescription: d.publicRecruitingDescription ?? null,
      season: d.season ?? null,
      applicationDeadline: deadline,
      availableSpots: d.availableSpots ?? null,
      acceptedCountries: d.acceptedCountries ?? null,
      ageCategories: d.ageCategories ?? null,
      rankingRequirement: d.rankingRequirement ?? null,
      programTypes: d.programTypes.length ? d.programTypes.join(", ") : null,
      applicationUrl: d.applicationUrl ?? null,
      featuredAcademy: d.featuredAcademy,
      contactEmail: d.contactEmail ?? null,
      publicApplyEnabled: d.publicApplyEnabled,
    },
  });

  revalidatePath("/recruiting");
  return { ok: true };
}

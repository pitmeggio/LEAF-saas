"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAcademyId } from "@/lib/auth";
import { publicProfileSchema, firstError, type PublicProfileInput } from "@/lib/validation";

export type Result = { ok: boolean; error?: string };

// Update an athlete's public-profile settings. Tenant-scoped: the caller may only
// edit athletes who are enrolled at their academy. SUPER_ADMIN is rejected by
// requireAcademyId() (platform users don't manage tenant athletes).
export async function updatePublicProfile(input: PublicProfileInput): Promise<Result> {
  const parsed = publicProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const academyId = await requireAcademyId();
  // Ownership: athlete must belong to this academy (via an enrollment).
  const owned = await prisma.enrollment.findFirst({ where: { athleteId: d.athleteId, academyId }, select: { id: true } });
  if (!owned) return { ok: false, error: "Athlete not found in your academy." };

  // Slug uniqueness across all athletes (public slugs are global).
  if (d.publicSlug) {
    const clash = await prisma.athlete.findUnique({ where: { publicSlug: d.publicSlug }, select: { id: true } });
    if (clash && clash.id !== d.athleteId) return { ok: false, error: "That public link is already taken." };
  }

  // FIS code uniqueness (also a global unique column).
  if (d.fisCode) {
    const clash = await prisma.athlete.findUnique({ where: { fisCode: d.fisCode }, select: { id: true } });
    if (clash && clash.id !== d.athleteId) return { ok: false, error: "That FIS code belongs to another athlete." };
  }

  await prisma.athlete.update({
    where: { id: d.athleteId },
    data: {
      publicProfileEnabled: d.publicProfileEnabled,
      publicSlug: d.publicSlug ?? null,
      publicVisibility: d.publicVisibility,
      publicBio: d.publicBio ?? null,
      publicPhotoUrl: d.publicPhotoUrl ?? null,
      publicShowAcademy: d.publicShowAcademy,
      publicShowRanking: d.publicShowRanking,
      publicShowResults: d.publicShowResults,
      publicShowMedia: d.publicShowMedia,
      publicShowExternalProfiles: d.publicShowExternalProfiles,
      publicContactEnabled: d.publicContactEnabled,
      publicVerified: d.publicVerified,
      fisCode: d.fisCode ?? null,
      fisProfileUrl: d.fisProfileUrl ?? null,
      atpPlayerId: d.atpPlayerId ?? null,
      atpProfileUrl: d.atpProfileUrl ?? null,
    },
  });

  revalidatePath(`/members`);
  if (d.publicSlug) revalidatePath(`/profiles/${d.publicSlug}`);
  return { ok: true };
}

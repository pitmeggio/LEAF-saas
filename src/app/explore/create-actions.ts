"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { importAthleteByFisCode } from "@/lib/fis/import";
import { fisCodeSchema, firstError } from "@/lib/validation";

export type CreateProfileState = { error?: string };

const createProfileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  source: z.enum(["fis", "atp"]).default("fis"),
  code: fisCodeSchema,
});

// Build a URL-safe slug from a name, then guarantee global uniqueness by suffixing.
function baseSlug(first: string, last: string): string {
  // NFD splits accented letters into base + combining mark; the [^a-z0-9] pass then
  // drops the (non-alphanumeric) marks, so "Müller" → "muller", "Kovač" → "kovac".
  const s = `${first} ${last}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "athlete";
}

async function uniqueSlug(first: string, last: string, athleteId: string): Promise<string> {
  const base = baseSlug(first, last);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const clash = await prisma.athlete.findUnique({ where: { publicSlug: candidate }, select: { id: true } });
    if (!clash || clash.id === athleteId) return candidate;
  }
  // Extremely unlikely fallback — append a short id fragment.
  return `${base}-${athleteId.slice(-5)}`;
}

// Self-serve athlete onboarding: an athlete enters their name + FIS code, we import the
// FIS-published record (points, history, results), build a verified public profile and
// hand them their shareable link. ATP is not wired to a provider yet.
export async function createProfileAction(_prev: CreateProfileState, formData: FormData): Promise<CreateProfileState> {
  const parsed = createProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  if (d.source === "atp") {
    return { error: "ATP import is coming soon. For now, create your profile with a FIS code." };
  }

  const imported = await importAthleteByFisCode(d.code);
  if (!imported) {
    return { error: `No FIS record found for "${d.code}". Double-check the code and try again.` };
  }

  // Use the athlete's typed name for display, keep the FIS-imported performance data.
  // Publish the profile (link-shareable) and mark it verified — the data came from FIS.
  const slug = await uniqueSlug(d.firstName, d.lastName, imported.athleteId);
  await prisma.athlete.update({
    where: { id: imported.athleteId },
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      publicSlug: slug,
      publicProfileEnabled: true,
      publicVisibility: "PUBLIC",
      publicVerified: true,
      publicShowRanking: true,
      publicShowResults: true,
    },
  });

  redirect(`/athlete/${slug}?new=1`);
}

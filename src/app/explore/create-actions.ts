"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { importAthleteByFisCode } from "@/lib/fis/import";
import { fisCodeSchema, firstError } from "@/lib/validation";
import { hashPassword, makeSessionToken } from "@/lib/password";
import { SESSION_COOKIE } from "@/lib/auth";

export type CreateProfileState = { error?: string };

const createProfileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : undefined))
    .refine((v) => v === undefined || v.length >= 8, { message: "Password must be at least 8 characters." }),
  source: z.enum(["fis", "atp"]).default("fis"),
  code: fisCodeSchema,
  consent: z.string().optional(), // "on" when accepted
}).refine((d) => d.consent === "on", {
  message: "Please accept the data & privacy terms to continue.",
  path: ["consent"],
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
  // Platform-level gate — self-serve athlete signup creates a public profile.
  // While the discovery / marketplace layer isn't live, the resulting profile
  // would be invisible (404 at /athlete/[slug] thanks to the academy-level
  // feature flag). Return a clear error instead of creating an orphan record.
  const { publicProfileSignupEnabled } = await import("@/lib/plans");
  if (!publicProfileSignupEnabled()) {
    return { error: "Self-serve athlete profiles are paused. Ask your academy to invite you to LEAF." };
  }
  const parsed = createProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  if (d.source === "atp") {
    return { error: "ATP import is coming soon. For now, create your profile with a FIS code." };
  }

  // The email must be free to use as a login.
  const emailClash = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } });
  if (emailClash) return { error: "That email already has a LEAF account — sign in instead." };

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
      email: d.email,
      publicSlug: slug,
      publicProfileEnabled: true,
      publicVisibility: "PUBLIC",
      publicVerified: true,
      publicShowRanking: true,
      publicShowResults: true,
    },
  });

  // Create the athlete's own login linked to this profile (their "My Profile"
  // workspace). A blank password is claimed on first sign-in.
  const user = await prisma.user.create({
    data: {
      name: `${d.firstName} ${d.lastName}`,
      email: d.email,
      role: "athlete",
      athleteId: imported.athleteId,
      passwordHash: d.password ? await hashPassword(d.password) : null,
    },
  });

  // Sign them in immediately and drop them into their workspace.
  const jar = await cookies();
  jar.set(SESSION_COOKIE, makeSessionToken(user.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });

  redirect(`/me?new=1`);
}

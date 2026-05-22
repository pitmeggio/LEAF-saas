"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import {
  academyCreateSchema,
  academyUpdateSchema,
  academyStatusUpdateSchema,
  academyPlanUpdateSchema,
  userCreateSchema,
  userUpdateSchema,
  userPasswordSchema,
  userDeleteSchema,
  academyConfigSchema,
  academyRequestReviewSchema,
  firstError,
} from "@/lib/validation";
import { planDef } from "@/lib/plans";
import { currencyForCountry } from "@/lib/currency";

export type Result = { ok: boolean; error?: string; id?: string };

function revalidate() {
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/people");
  revalidatePath("/super-admin/requests");
}

// All actions below are platform-level and MUST be gated by requireSuperAdmin().
export async function createAcademy(input: unknown): Promise<Result> {
  await requireSuperAdmin();
  const parsed = academyCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { name, slug, country, location, plan } = parsed.data;

  const clash = await prisma.academy.findUnique({ where: { slug } });
  if (clash) return { ok: false, error: "That slug is already taken." };

  const academy = await prisma.academy.create({
    data: { name, slug, country, location, plan, sport: "ski", currency: currencyForCountry(country) },
  });
  revalidate();
  return { ok: true, id: academy.id };
}

export async function updateAcademy(input: unknown): Promise<Result> {
  await requireSuperAdmin();
  const parsed = academyUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, name, slug, logoColor, status, plan } = parsed.data;

  const existing = await prisma.academy.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Academy not found." };

  const clash = await prisma.academy.findUnique({ where: { slug } });
  if (clash && clash.id !== id) return { ok: false, error: "That slug is already taken." };

  await prisma.academy.update({ where: { id }, data: { name, slug, logoColor, status, plan } });
  revalidate();
  return { ok: true, id };
}

export async function setAcademyStatus(input: unknown): Promise<Result> {
  await requireSuperAdmin();
  const parsed = academyStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, status } = parsed.data;
  const existing = await prisma.academy.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Academy not found." };
  await prisma.academy.update({ where: { id }, data: { status } });
  revalidate();
  return { ok: true, id };
}

export async function setAcademyPlan(input: unknown): Promise<Result> {
  await requireSuperAdmin();
  const parsed = academyPlanUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, plan } = parsed.data;
  const existing = await prisma.academy.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Academy not found." };
  // Assigning a plan provisions its default feature set + athlete limit. The
  // super-admin can still override individual flags afterwards via Configure.
  const def = planDef(plan);
  await prisma.academy.update({
    where: { id },
    data: { plan, ...def.features, maxAthletes: def.maxAthletes },
  });
  revalidate();
  return { ok: true, id };
}

// Per-tenant configuration: branding + feature flags + athlete limit.
export async function updateAcademyConfig(input: unknown): Promise<Result> {
  await requireSuperAdmin();
  const parsed = academyConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, tagline, description, contactEmail, logoColor, featureRecruiting, featurePublicProfiles, featureFinance, featureChat, maxAthletes, requiredDocs } = parsed.data;
  const existing = await prisma.academy.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Academy not found." };
  await prisma.academy.update({
    where: { id },
    data: {
      tagline: tagline ?? null,
      description: description ?? null,
      contactEmail: contactEmail ?? null,
      logoColor,
      featureRecruiting,
      featurePublicProfiles,
      featureFinance,
      featureChat,
      maxAthletes: maxAthletes ?? null,
      requiredDocs: requiredDocs ?? null,
    },
  });
  revalidate();
  return { ok: true, id };
}

// ── Account management ───────────────────────────────────────────────────────
// super_admin users have no academy; an academy_admin/coach/recruiter/athlete is
// bound to one. A blank password means the account is claimed on first sign-in.
export async function createUser(input: unknown): Promise<Result> {
  await requireSuperAdmin();
  const parsed = userCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { name, email, role, academyId, password } = parsed.data;

  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash) return { ok: false, error: "That email is already in use." };

  const finalAcademyId = role === "super_admin" ? null : academyId ?? null;
  if (finalAcademyId) {
    const academy = await prisma.academy.findUnique({ where: { id: finalAcademyId } });
    if (!academy) return { ok: false, error: "Academy not found." };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      academyId: finalAcademyId,
      passwordHash: password ? await hashPassword(password) : null,
    },
  });
  revalidate();
  return { ok: true, id: user.id };
}

export async function updateUser(input: unknown): Promise<Result> {
  await requireSuperAdmin();
  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, name, email, role, academyId } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "User not found." };

  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash && clash.id !== id) return { ok: false, error: "That email is already in use." };

  const finalAcademyId = role === "super_admin" ? null : academyId ?? null;
  if (finalAcademyId) {
    const academy = await prisma.academy.findUnique({ where: { id: finalAcademyId } });
    if (!academy) return { ok: false, error: "Academy not found." };
  }

  await prisma.user.update({ where: { id }, data: { name, email, role, academyId: finalAcademyId } });
  revalidate();
  return { ok: true, id };
}

export async function setUserPassword(input: unknown): Promise<Result> {
  await requireSuperAdmin();
  const parsed = userPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "User not found." };
  // blank password clears the credential → account is claimed on next sign-in
  await prisma.user.update({ where: { id }, data: { passwordHash: password ? await hashPassword(password) : null } });
  revalidate();
  return { ok: true, id };
}

export async function deleteUser(input: unknown): Promise<Result> {
  const me = await requireSuperAdmin();
  const parsed = userDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id } = parsed.data;
  if (id === me.userId) return { ok: false, error: "You can't delete your own account." };
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "User not found." };
  await prisma.user.delete({ where: { id } });
  revalidate();
  return { ok: true, id };
}

// ── Academy onboarding lifecycle ─────────────────────────────────────────────
// Approve provisions a full tenant: an Academy with the plan's default features +
// limit, and an academy_admin owner account (claimed on first sign-in). Reject
// just records the decision. Idempotent: a non-pending request can't be re-reviewed.
export async function reviewAcademyRequest(input: unknown): Promise<Result> {
  await requireSuperAdmin();
  const parsed = academyRequestReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, action, plan, slug, reviewerNote } = parsed.data;

  const req = await prisma.academyRequest.findUnique({ where: { id } });
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "pending") return { ok: false, error: "This request has already been reviewed." };

  if (action === "reject") {
    await prisma.academyRequest.update({
      where: { id },
      data: { status: "rejected", reviewedAt: new Date(), reviewerNote: reviewerNote ?? null },
    });
    revalidate();
    return { ok: true, id };
  }

  // Approve → provision tenant.
  const finalPlan = plan ?? (req.plan as "BASIC" | "PRO" | "ELITE");
  const def = planDef(finalPlan);

  const slugClash = await prisma.academy.findUnique({ where: { slug: slug! } });
  if (slugClash) return { ok: false, error: "That slug is already taken." };

  const academy = await prisma.academy.create({
    data: {
      name: req.academyName,
      slug: slug!,
      country: req.country,
      location: req.location,
      sport: req.sport,
      plan: finalPlan,
      currency: currencyForCountry(req.country),
      ...def.features,
      maxAthletes: def.maxAthletes,
    },
  });

  // Owner account — only if the email isn't already a user.
  const existingUser = await prisma.user.findUnique({ where: { email: req.email } });
  if (!existingUser) {
    await prisma.user.create({
      data: { name: req.contactName, email: req.email, role: "academy_admin", academyId: academy.id, passwordHash: null },
    });
  }

  await prisma.academyRequest.update({
    where: { id },
    data: { status: "approved", reviewedAt: new Date(), reviewerNote: reviewerNote ?? null, provisionedAcademyId: academy.id, plan: finalPlan },
  });
  revalidate();
  return { ok: true, id: academy.id };
}

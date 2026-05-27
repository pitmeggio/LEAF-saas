"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { firstError } from "@/lib/validation";

// Create a sign-in account for an existing Coach record. The academy
// admin uses this from /dashboard/coaches → "Create login" on a coach
// card; the coach can then log in at /login with the email + password
// set here and lands on their scoped workspace (only their groups and
// only their athletes).
//
// Admin-only and tenant-scoped: the coach must belong to the same
// academy as the calling admin.

type Result = { ok: true } | { ok: false; error: string };

const inputSchema = z.object({
  coachId: z.string().min(1),
  email: z.string().trim().toLowerCase().min(3).max(120).email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters").max(120),
});

export async function createCoachLogin(input: { coachId: string; email: string; password: string }): Promise<Result> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { coachId, email, password } = parsed.data;

  const session = await requireAdmin();
  if (!session.academyId) return { ok: false, error: "No academy in session." };

  // Coach must exist + belong to this academy. Tenant scoping check.
  const coach = await prisma.coach.findFirst({
    where: { id: coachId, academyId: session.academyId },
    select: { id: true, name: true, email: true, users: { select: { id: true } } },
  });
  if (!coach) return { ok: false, error: "Coach not found in your academy." };

  // Block double-account: a coach should have one login. If they already
  // do, the admin should use the "Reset password" flow instead.
  if (coach.users.length > 0) {
    return { ok: false, error: "This coach already has a login account." };
  }

  // Block email collision against any existing user (across roles).
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) return { ok: false, error: "An account with this email already exists." };

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      name: coach.name,
      email,
      passwordHash,
      role: "coach",
      academyId: session.academyId,
      coachId: coach.id,
    },
  });

  // If the coach record itself was missing its email, copy it here so
  // the directory stays consistent — same person, same email everywhere.
  if (!coach.email) {
    await prisma.coach.update({ where: { id: coach.id }, data: { email } });
  }

  revalidatePath("/dashboard/coaches");
  return { ok: true };
}

const resetSchema = z.object({
  coachId: z.string().min(1),
  password: z.string().min(6).max(120),
});

// Reset the password of an existing coach login. Surfaced as a small
// link on the coach card when the account already exists.
export async function resetCoachPassword(input: { coachId: string; password: string }): Promise<Result> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const session = await requireAdmin();
  if (!session.academyId) return { ok: false, error: "No academy in session." };

  const coach = await prisma.coach.findFirst({
    where: { id: parsed.data.coachId, academyId: session.academyId },
    select: { users: { select: { id: true } } },
  });
  if (!coach || coach.users.length === 0) return { ok: false, error: "Coach has no login yet." };

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: coach.users[0].id },
    data: { passwordHash },
  });
  revalidatePath("/dashboard/coaches");
  return { ok: true };
}

"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import {
  academyCreateSchema,
  academyUpdateSchema,
  academyStatusUpdateSchema,
  academyPlanUpdateSchema,
  firstError,
} from "@/lib/validation";

export type Result = { ok: boolean; error?: string; id?: string };

function revalidate() {
  revalidatePath("/super-admin");
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
    data: { name, slug, country, location, plan, sport: "ski" },
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
  await prisma.academy.update({ where: { id }, data: { plan } });
  revalidate();
  return { ok: true, id };
}

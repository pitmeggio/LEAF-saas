"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAcademyId } from "@/lib/auth";
import { contractCreateSchema, contractUpdateSchema, contractStatusUpdateSchema, firstError } from "@/lib/validation";

export type Result = { ok: boolean; error?: string; id?: string };

function rev(enrollmentId?: string) {
  revalidatePath("/dashboard/members");
  if (enrollmentId) revalidatePath(`/dashboard/members/${enrollmentId}`);
}

export async function createContract(input: unknown): Promise<Result> {
  const academyId = await requireAcademyId();
  const parsed = contractCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const enr = await prisma.enrollment.findFirst({ where: { id: d.enrollmentId, academyId } });
  if (!enr) return { ok: false, error: "Enrollment not found." };
  // Contracts are with the academy → priced in its national currency.
  const currency = (await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } }))?.currency ?? "EUR";

  const c = await prisma.contract.create({
    data: {
      academyId, enrollmentId: d.enrollmentId, title: d.title, status: d.status,
      startDate: d.startDate ? new Date(d.startDate) : null,
      endDate: d.endDate ? new Date(d.endDate) : null,
      value: d.value ?? null, currency, notes: d.notes ?? null,
      signedAt: d.status === "signed" ? new Date() : null,
    },
  });
  rev(d.enrollmentId);
  return { ok: true, id: c.id };
}

export async function updateContract(input: unknown): Promise<Result> {
  const academyId = await requireAcademyId();
  const parsed = contractUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const existing = await prisma.contract.findFirst({ where: { id: d.id, academyId } });
  if (!existing) return { ok: false, error: "Contract not found." };
  const currency = (await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } }))?.currency ?? "EUR";
  await prisma.contract.update({
    where: { id: d.id },
    data: {
      title: d.title, status: d.status,
      startDate: d.startDate ? new Date(d.startDate) : null,
      endDate: d.endDate ? new Date(d.endDate) : null,
      value: d.value ?? null, currency, notes: d.notes ?? null,
      signedAt: d.status === "signed" ? (existing.signedAt ?? new Date()) : null,
    },
  });
  rev(existing.enrollmentId);
  return { ok: true, id: d.id };
}

export async function setContractStatus(input: unknown): Promise<Result> {
  const academyId = await requireAcademyId();
  const parsed = contractStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, status } = parsed.data;
  const existing = await prisma.contract.findFirst({ where: { id, academyId } });
  if (!existing) return { ok: false, error: "Contract not found." };
  await prisma.contract.update({
    where: { id },
    data: { status, signedAt: status === "signed" ? (existing.signedAt ?? new Date()) : null },
  });
  rev(existing.enrollmentId);
  return { ok: true, id };
}

export async function deleteContract(id: string): Promise<Result> {
  const academyId = await requireAcademyId();
  const existing = await prisma.contract.findFirst({ where: { id, academyId } });
  if (!existing) return { ok: false, error: "Contract not found." };
  await prisma.contract.delete({ where: { id } });
  rev(existing.enrollmentId);
  return { ok: true };
}

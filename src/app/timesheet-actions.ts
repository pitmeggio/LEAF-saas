"use server";

// Foglio ore & Stipendi actions. Coaches submit hours; admin/office approve +
// mark paid. Submission-with-file goes through /api/timesheets/upload (multipart);
// these handle the state transitions + delete. All tenant-scoped.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireBackOffice, getSession } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

function rev() {
  revalidatePath("/dashboard/timesheets");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}

// Admin/office state transitions — the timesheet must belong to their academy.
async function scopedTimesheet(id: string): Promise<{ academyId: string } | null> {
  const s = await requireBackOffice();
  if (!s.academyId) return null;
  const t = await prisma.timesheet.findFirst({ where: { id, academyId: s.academyId }, select: { id: true } });
  return t ? { academyId: s.academyId } : null;
}

export async function approveTimesheet(id: string): Promise<Result> {
  if (!(await scopedTimesheet(id))) return { ok: false, error: "Foglio ore non trovato." };
  await prisma.timesheet.update({ where: { id }, data: { status: "approved", approvedAt: new Date(), paidAt: null } });
  rev();
  return { ok: true };
}

export async function markTimesheetPaid(id: string): Promise<Result> {
  if (!(await scopedTimesheet(id))) return { ok: false, error: "Foglio ore non trovato." };
  await prisma.timesheet.update({ where: { id }, data: { status: "paid", paidAt: new Date() } });
  rev();
  return { ok: true };
}

export async function unmarkTimesheetPaid(id: string): Promise<Result> {
  if (!(await scopedTimesheet(id))) return { ok: false, error: "Foglio ore non trovato." };
  await prisma.timesheet.update({ where: { id }, data: { status: "approved", paidAt: null } });
  rev();
  return { ok: true };
}

// Delete — the owning coach (while not yet paid) OR admin/office.
export async function deleteTimesheet(id: string): Promise<Result> {
  const s = await getSession();
  if (!s?.academyId) return { ok: false, error: "Sessione non valida." };
  const t = await prisma.timesheet.findFirst({ where: { id, academyId: s.academyId }, select: { id: true, coachId: true, status: true } });
  if (!t) return { ok: false, error: "Foglio ore non trovato." };
  const isOwnerCoach = s.isCoach && s.coachId === t.coachId && t.status !== "paid";
  if (!s.isAdmin && !s.isOffice && !isOwnerCoach) return { ok: false, error: "Non autorizzato." };
  await prisma.timesheet.delete({ where: { id } });
  rev();
  return { ok: true };
}

"use server";

import { prisma } from "@/lib/db";
import { getSession, requireAcademyId } from "@/lib/auth";
import { expenseInputSchema, firstError, type ExpenseInput } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type Result = { ok: boolean; error?: string };

function revalidateExpenses() {
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/groups");
  revalidatePath("/reports");
}

// Coach creates their own expense (draft). Admin may create on behalf of a coach (rare).
export async function createExpense(input: ExpenseInput & { coachId?: string }): Promise<Result> {
  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();

  const coachId = s.coachId ?? input.coachId;
  if (!coachId) return { ok: false, error: "No coach linked to this account" };

  // A coach can only create against a group they own.
  if (parsed.data.groupId && !s.isAdmin) {
    const g = await prisma.group.findFirst({ where: { id: parsed.data.groupId, academyId, coachId } });
    if (!g) return { ok: false, error: "You can only file expenses for your own groups" };
  }

  await prisma.expense.create({
    data: { academyId, coachId, groupId: parsed.data.groupId, title: parsed.data.title, amount: parsed.data.amount, currency: parsed.data.currency, category: parsed.data.category, notes: parsed.data.notes, status: "draft" },
  });
  revalidateExpenses();
  return { ok: true };
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Result> {
  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();
  const exp = await prisma.expense.findFirst({ where: { id, academyId } });
  if (!exp) return { ok: false, error: "Not found" };
  // Owner coach can edit only their own draft; admin can edit any.
  if (!s.isAdmin && (exp.coachId !== s.coachId || exp.status !== "draft")) return { ok: false, error: "You can only edit your own draft expenses" };
  await prisma.expense.update({ where: { id }, data: { title: parsed.data.title, amount: parsed.data.amount, category: parsed.data.category, groupId: parsed.data.groupId, notes: parsed.data.notes } });
  revalidateExpenses();
  return { ok: true };
}

export async function submitExpense(id: string): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();
  const exp = await prisma.expense.findFirst({ where: { id, academyId } });
  if (!exp) return { ok: false, error: "Not found" };
  if (!s.isAdmin && exp.coachId !== s.coachId) return { ok: false, error: "Not your expense" };
  if (exp.status !== "draft") return { ok: false, error: "Only drafts can be submitted" };
  await prisma.expense.update({ where: { id }, data: { status: "submitted" } });
  revalidateExpenses();
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();
  const exp = await prisma.expense.findFirst({ where: { id, academyId } });
  if (!exp) return { ok: false, error: "Not found" };
  if (!s.isAdmin && (exp.coachId !== s.coachId || exp.status !== "draft")) return { ok: false, error: "You can only delete your own draft expenses" };
  await prisma.expense.delete({ where: { id } });
  revalidateExpenses();
  return { ok: true };
}

// Admin-only: approve / reject / mark reimbursed.
export async function setExpenseStatus(id: string, status: "approved" | "rejected" | "reimbursed"): Promise<Result> {
  const s = await getSession();
  if (!s?.isAdmin) return { ok: false, error: "Admin only" };
  const academyId = await requireAcademyId();
  const exp = await prisma.expense.findFirst({ where: { id, academyId } });
  if (!exp) return { ok: false, error: "Not found" };
  await prisma.expense.update({ where: { id }, data: { status } });
  revalidateExpenses();
  return { ok: true };
}

"use server";

import { prisma } from "@/lib/db";
import { getSession, requireAcademyId, type Session } from "@/lib/auth";
import { expenseInputSchema, firstError, type ExpenseInput } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type Result = { ok: boolean; error?: string; warning?: string };

function revalidateExpenses() {
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/groups");
  revalidatePath("/dashboard/reports");
}

// Append an immutable audit event for an expense (who did what, when).
async function logEvent(
  expenseId: string,
  type: string,
  s: Session | null,
  opts: { from?: string | null; to?: string | null; note?: string } = {},
) {
  await prisma.expenseEvent.create({
    data: {
      expenseId,
      type,
      fromStatus: opts.from ?? null,
      toStatus: opts.to ?? null,
      byUserId: s?.userId ?? null,
      byName: s?.name ?? null,
      note: opts.note ?? null,
    },
  });
}

// Approved + reimbursed expenses in the academy's base currency consume the budget.
async function consumedForGroup(groupId: string, baseCurrency: string, excludeId?: string): Promise<number> {
  const rows = await prisma.expense.findMany({
    where: { groupId, status: { in: ["approved", "reimbursed"] }, currency: baseCurrency, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { amount: true },
  });
  return rows.reduce((s, e) => s + e.amount, 0);
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

  const d = parsed.data;
  const exp = await prisma.expense.create({
    data: {
      academyId, coachId, groupId: d.groupId, title: d.title, amount: d.amount, currency: d.currency,
      category: d.category, notes: d.notes, status: "draft",
      expenseDate: d.expenseDate ? new Date(d.expenseDate) : null,
      receiptUrl: d.receiptUrl ?? null,
    },
  });
  await logEvent(exp.id, "created", s, { to: "draft" });
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
  const d = parsed.data;
  await prisma.expense.update({
    where: { id },
    data: {
      title: d.title, amount: d.amount, currency: d.currency, category: d.category, groupId: d.groupId, notes: d.notes,
      expenseDate: d.expenseDate ? new Date(d.expenseDate) : exp.expenseDate,
      receiptUrl: d.receiptUrl ?? exp.receiptUrl,
    },
  });
  await logEvent(id, "edited", s);
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
  await logEvent(id, "submitted", s, { from: "draft", to: "submitted" });
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

// Admin approves an expense. Safeguards:
//  • prevent double approval (must be in draft/submitted)
//  • no duplicate deduction — budget "consumed" is computed from approved expenses,
//    so re-approving the same row can never subtract twice
//  • optional hard stop when the group's budget would be exceeded
//  • full audit trail (who + when + over-budget note)
export async function approveExpense(id: string): Promise<Result> {
  const s = await getSession();
  if (!s?.isAdmin) return { ok: false, error: "Admin only" };
  const academyId = await requireAcademyId();
  const exp = await prisma.expense.findFirst({ where: { id, academyId }, include: { group: true } });
  if (!exp) return { ok: false, error: "Not found" };
  if (exp.status === "approved" || exp.status === "reimbursed") return { ok: false, error: "This expense is already approved." };

  // Over-budget check (only meaningful when the expense is in the academy's base currency).
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } });
  const baseCurrency = academy?.currency ?? "EUR";
  let warning: string | undefined;
  if (exp.group && exp.group.budget != null && exp.currency === baseCurrency) {
    const consumed = await consumedForGroup(exp.group.id, baseCurrency, exp.id);
    const after = consumed + exp.amount;
    if (after > exp.group.budget) {
      if (exp.group.budgetHardStop) {
        return { ok: false, error: `Approving would exceed ${exp.group.name}'s budget (hard stop on). Raise the budget or reject.` };
      }
      warning = `Heads up: ${exp.group.name} is now over budget (${after} / ${exp.group.budget} ${baseCurrency}).`;
    }
  }

  await prisma.expense.update({ where: { id }, data: { status: "approved", approvedById: s.userId, approvedAt: new Date() } });
  await logEvent(id, "approved", s, { from: exp.status, to: "approved", note: warning });
  revalidateExpenses();
  return { ok: true, warning };
}

export async function rejectExpense(id: string, note?: string): Promise<Result> {
  const s = await getSession();
  if (!s?.isAdmin) return { ok: false, error: "Admin only" };
  const academyId = await requireAcademyId();
  const exp = await prisma.expense.findFirst({ where: { id, academyId } });
  if (!exp) return { ok: false, error: "Not found" };
  if (exp.status === "rejected") return { ok: false, error: "Already rejected." };
  await prisma.expense.update({ where: { id }, data: { status: "rejected", approvedById: s.userId, approvedAt: new Date() } });
  await logEvent(id, "rejected", s, { from: exp.status, to: "rejected", note });
  revalidateExpenses();
  return { ok: true };
}

// Mark an approved expense as reimbursed (paid back to the coach).
export async function reimburseExpense(id: string): Promise<Result> {
  const s = await getSession();
  if (!s?.isAdmin) return { ok: false, error: "Admin only" };
  const academyId = await requireAcademyId();
  const exp = await prisma.expense.findFirst({ where: { id, academyId } });
  if (!exp) return { ok: false, error: "Not found" };
  if (exp.status !== "approved") return { ok: false, error: "Only approved expenses can be reimbursed." };
  await prisma.expense.update({ where: { id }, data: { status: "reimbursed" } });
  await logEvent(id, "reimbursed", s, { from: "approved", to: "reimbursed" });
  revalidateExpenses();
  return { ok: true };
}

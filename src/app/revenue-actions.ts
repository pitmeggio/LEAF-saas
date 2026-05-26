"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  revenueInputSchema,
  revenueUpdateSchema,
  revenueDeleteSchema,
  firstError,
  type RevenueInput,
  type RevenueUpdateInput,
} from "@/lib/validation";

type Result = { ok: true; id?: string } | { ok: false; error: string };

// Income / Revenue ledger — non-Payment streams (sponsor, federation,
// academy allocation, misc). Tied to a team (group) when applicable so
// the Budget Tracker can render per-team net result.

function revalidate() {
  revalidatePath(`/dashboard/budgets`);
  revalidatePath(`/dashboard/finance`);
  revalidatePath(`/dashboard/groups`);
  revalidatePath(`/dashboard/reports`);
}

export async function createRevenue(input: RevenueInput): Promise<Result> {
  const parsed = revenueInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const session = await requireAdmin();
  if (!session.academyId) return { ok: false, error: "No academy in session." };

  let receivedDate: Date | null = null;
  if (d.receivedDate) {
    const dt = new Date(d.receivedDate);
    if (isNaN(dt.getTime())) return { ok: false, error: "Invalid received date." };
    receivedDate = dt;
  }

  // If groupId set, enforce tenant ownership.
  if (d.groupId) {
    const g = await prisma.group.findFirst({ where: { id: d.groupId, academyId: session.academyId }, select: { id: true } });
    if (!g) return { ok: false, error: "Group not in this academy." };
  }

  const created = await prisma.revenue.create({
    data: {
      academyId: session.academyId,
      groupId: d.groupId ?? null,
      title: d.title,
      amount: d.amount,
      currency: d.currency,
      category: d.category,
      status: d.status,
      receivedDate,
      source: d.source ?? null,
      notes: d.notes ?? null,
    },
  });
  revalidate();
  return { ok: true, id: created.id };
}

export async function updateRevenue(input: RevenueUpdateInput): Promise<Result> {
  const parsed = revenueUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const session = await requireAdmin();
  if (!session.academyId) return { ok: false, error: "No academy in session." };

  const existing = await prisma.revenue.findFirst({ where: { id: d.id, academyId: session.academyId }, select: { id: true } });
  if (!existing) return { ok: false, error: "Revenue entry not found." };

  let receivedDate: Date | null = null;
  if (d.receivedDate) {
    const dt = new Date(d.receivedDate);
    if (isNaN(dt.getTime())) return { ok: false, error: "Invalid received date." };
    receivedDate = dt;
  }

  await prisma.revenue.update({
    where: { id: d.id },
    data: {
      groupId: d.groupId ?? null,
      title: d.title,
      amount: d.amount,
      currency: d.currency,
      category: d.category,
      status: d.status,
      receivedDate,
      source: d.source ?? null,
      notes: d.notes ?? null,
    },
  });
  revalidate();
  return { ok: true };
}

export async function deleteRevenue(input: { id: string }): Promise<Result> {
  const parsed = revenueDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const session = await requireAdmin();
  if (!session.academyId) return { ok: false, error: "No academy in session." };

  const existing = await prisma.revenue.findFirst({ where: { id: parsed.data.id, academyId: session.academyId }, select: { id: true } });
  if (!existing) return { ok: false, error: "Revenue entry not found." };

  await prisma.revenue.delete({ where: { id: parsed.data.id } });
  revalidate();
  return { ok: true };
}

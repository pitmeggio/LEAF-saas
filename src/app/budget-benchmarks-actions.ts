"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { budgetBenchmarksSchema, firstError, type BudgetBenchmarksInput } from "@/lib/validation";

type Result = { ok: true } | { ok: false; error: string };

// Upsert the academy's cost benchmarks (1:1 row keyed by academyId). The
// budget forecast engine reads these on every Budgets page render — keep
// this action snappy. Admin-only; tenant scoping comes from the session.
export async function upsertBudgetBenchmarks(input: BudgetBenchmarksInput): Promise<Result> {
  const parsed = budgetBenchmarksSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const session = await requireAdmin();
  if (!session.academyId) return { ok: false, error: "No academy in session." };

  const d = parsed.data;
  await prisma.academyBudgetBenchmarks.upsert({
    where: { academyId: session.academyId },
    create: { academyId: session.academyId, ...d },
    update: { ...d },
  });
  // Forecast surfaces all live on the Budgets page (academy + per-group).
  revalidatePath("/dashboard/budgets");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

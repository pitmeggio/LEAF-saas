"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getFinanceProvider } from "@/lib/finance";
import { syncAcademyFinance } from "@/lib/finance/sync";

export type FinanceActionResult = { ok: boolean; error?: string; message?: string };

// Connect the current academy to an external finance provider. Academy-admin only,
// tenant-scoped. Only implemented connectors are accepted.
export async function connectFinanceProvider(provider: string): Promise<FinanceActionResult> {
  const session = await requireAdmin();
  const academyId = session.academyId;
  if (!academyId) return { ok: false, error: "No academy in session." };
  if (!getFinanceProvider(provider)) return { ok: false, error: "That connector isn't available yet." };

  await prisma.academy.update({ where: { id: academyId }, data: { financeProvider: provider } });
  revalidatePath("/dashboard/payments");
  return { ok: true, message: "Connected. Run a sync to pull invoices." };
}

// Disconnect — restores LEAF-managed billing. Synced rows are left in place (they are
// tagged source="external" and can be cleared separately).
export async function disconnectFinance(): Promise<FinanceActionResult> {
  const session = await requireAdmin();
  const academyId = session.academyId;
  if (!academyId) return { ok: false, error: "No academy in session." };

  await prisma.academy.update({ where: { id: academyId }, data: { financeProvider: null } });
  revalidatePath("/dashboard/payments");
  return { ok: true, message: "Disconnected. LEAF-managed billing restored." };
}

// Map an enrollment to its customer id in the external finance system. This is the
// key the sync uses to attach external invoices to the right athlete. Tenant-scoped.
export async function setEnrollmentExternalId(enrollmentId: string, externalId: string): Promise<FinanceActionResult> {
  const session = await requireAdmin();
  const academyId = session.academyId;
  if (!academyId) return { ok: false, error: "No academy in session." };

  const enrollment = await prisma.enrollment.findFirst({ where: { id: enrollmentId, academyId }, select: { id: true } });
  if (!enrollment) return { ok: false, error: "Enrollment not found." };

  const value = externalId.trim().slice(0, 120) || null;
  await prisma.enrollment.update({ where: { id: enrollment.id }, data: { externalCustomerId: value } });
  revalidatePath(`/dashboard/members/${enrollmentId}`);
  return { ok: true, message: value ? "Saved. Run a sync to pull this athlete's invoices." : "Cleared." };
}

// Pull the latest invoice/payment data from the connected provider.
export async function syncFinanceNow(): Promise<FinanceActionResult> {
  const session = await requireAdmin();
  const academyId = session.academyId;
  if (!academyId) return { ok: false, error: "No academy in session." };

  const r = await syncAcademyFinance(academyId);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/dashboard/payments");
  const note = r.unmatched ? ` · ${r.unmatched} unmatched (map their customer IDs)` : "";
  return { ok: true, message: `Synced ${r.matched} invoice(s)${note}.` };
}

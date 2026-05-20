"use server";

import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import {
  enrollmentStatusSchema,
  reassignSchema,
  enrollmentNotesSchema,
  paymentStatusSchema,
  documentUpdateSchema,
} from "@/lib/validation";
import { syncInvoiceWithPayment } from "@/lib/invoices";
import { notify } from "@/lib/notifications";
import { enrollAcceptedApplication } from "@/lib/enrollment";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: boolean; error?: string };

// Admin-confirmed acceptance: sets the application to accepted and enrolls the
// athlete with the package/group/coach chosen in the confirmation modal.
export async function confirmAcceptance(
  applicationId: string,
  opts: { packageId?: string | null; groupId?: string | null; coachId?: string | null },
): Promise<ActionResult> {
  const academyId = await requireAcademyId();
  const app = await prisma.application.findFirst({ where: { id: applicationId, academyId } });
  if (!app) return { ok: false, error: "Not found" };

  // Validate chosen entities belong to this academy.
  for (const [key, model] of [["packageId", "package"], ["groupId", "group"], ["coachId", "coach"]] as const) {
    const v = opts[key];
    if (v) {
      const exists = await (prisma[model] as { findFirst: (a: unknown) => Promise<unknown> }).findFirst({ where: { id: v, academyId } });
      if (!exists) return { ok: false, error: `Invalid ${model}` };
    }
  }

  if (app.status !== "accepted") {
    await prisma.application.update({ where: { id: app.id }, data: { status: "accepted" } });
    await prisma.statusEvent.create({ data: { applicationId: app.id, from: app.status, to: "accepted" } });
  }
  await enrollAcceptedApplication(app.id, opts);

  for (const p of ["/", "/applications", `/applications/${app.id}`, "/members", "/payments", "/documents", "/alerts", "/reports", "/groups", "/coaches"]) revalidatePath(p);
  return { ok: true };
}

function revalidateOps(enrollmentId?: string) {
  revalidatePath("/");
  revalidatePath("/members");
  revalidatePath("/groups");
  revalidatePath("/coaches");
  revalidatePath("/packages");
  revalidatePath("/payments");
  revalidatePath("/documents");
  revalidatePath("/alerts");
  revalidatePath("/reports");
  if (enrollmentId) revalidatePath(`/members/${enrollmentId}`);
}

// Verify an enrollment belongs to the active academy (multi-tenant guard).
async function ownedEnrollment(enrollmentId: string) {
  const academyId = await requireAcademyId();
  return prisma.enrollment.findFirst({ where: { id: enrollmentId, academyId } });
}

export async function setEnrollmentStatus(enrollmentId: string, status: string): Promise<ActionResult> {
  const parsed = enrollmentStatusSchema.safeParse({ enrollmentId, status });
  if (!parsed.success) return { ok: false, error: "Invalid status" };
  const e = await ownedEnrollment(parsed.data.enrollmentId);
  if (!e) return { ok: false, error: "Not found" };
  if (e.status === parsed.data.status) return { ok: true };

  await prisma.enrollment.update({ where: { id: e.id }, data: { status: parsed.data.status } });
  await prisma.enrollmentEvent.create({ data: { enrollmentId: e.id, type: "status", from: e.status, to: parsed.data.status, detail: `Status → ${parsed.data.status}` } });
  // keep the athlete-level injury flag in sync with the "injured" status
  await prisma.athlete.update({ where: { id: e.athleteId }, data: { injuryFlag: parsed.data.status === "injured" } });
  revalidateOps(e.id);
  return { ok: true };
}

export async function archiveEnrollment(enrollmentId: string): Promise<ActionResult> {
  return setEnrollmentStatus(enrollmentId, "inactive");
}

export async function reassignEnrollment(enrollmentId: string, target: "group" | "coach" | "package", value: string | null): Promise<ActionResult> {
  const parsed = reassignSchema.safeParse({ enrollmentId, target, value: value ?? undefined });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const academyId = await requireAcademyId();
  const e = await prisma.enrollment.findFirst({ where: { id: parsed.data.enrollmentId, academyId } });
  if (!e) return { ok: false, error: "Not found" };
  const v = parsed.data.value;

  // Validate the target entity belongs to this academy.
  if (v) {
    const exists =
      target === "group"
        ? await prisma.group.findFirst({ where: { id: v, academyId } })
        : target === "coach"
          ? await prisma.coach.findFirst({ where: { id: v, academyId } })
          : await prisma.package.findFirst({ where: { id: v, academyId } });
    if (!exists) return { ok: false, error: "Invalid assignment" };
  }

  const data = target === "group" ? { groupId: v } : target === "coach" ? { coachId: v } : { packageId: v };
  await prisma.enrollment.update({ where: { id: e.id }, data });
  await prisma.enrollmentEvent.create({ data: { enrollmentId: e.id, type: "status", detail: `${target} reassigned` } });
  revalidateOps(e.id);
  return { ok: true };
}

export async function updateEnrollmentNotes(enrollmentId: string, notes: string): Promise<ActionResult> {
  const parsed = enrollmentNotesSchema.safeParse({ enrollmentId, notes });
  if (!parsed.success) return { ok: false, error: "Invalid notes" };
  const e = await ownedEnrollment(parsed.data.enrollmentId);
  if (!e) return { ok: false, error: "Not found" };
  await prisma.enrollment.update({ where: { id: e.id }, data: { notes: parsed.data.notes } });
  revalidatePath(`/members/${e.id}`);
  return { ok: true };
}

export async function setPaymentStatus(paymentId: string, status: string, opts?: { amount?: number; method?: string }): Promise<ActionResult> {
  const parsed = paymentStatusSchema.safeParse({ paymentId, status, amount: opts?.amount, method: opts?.method });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const academyId = await requireAcademyId();
  const p = await prisma.payment.findFirst({ where: { id: parsed.data.paymentId, academyId } });
  if (!p) return { ok: false, error: "Not found" };

  // Resolve the collected amount + effective status. A "partial" that covers the
  // full amount becomes "paid".
  let to = parsed.data.status;
  let paidAmount = 0;
  if (to === "paid") paidAmount = p.amount;
  else if (to === "partial") {
    paidAmount = Math.max(0, Math.min(parsed.data.amount ?? Math.round(p.amount / 2), p.amount));
    if (paidAmount >= p.amount) to = "paid";
    if (paidAmount <= 0) to = "unpaid";
  }
  const becamePaid = to === "paid" && p.status !== "paid";

  await prisma.payment.update({
    where: { id: p.id },
    data: {
      status: to,
      paidAmount,
      paidDate: to === "paid" ? new Date() : null,
      method: to === "paid" ? (parsed.data.method ?? p.method ?? "bank_transfer") : null,
    },
  });
  await prisma.enrollmentEvent.create({ data: { enrollmentId: p.enrollmentId, type: "payment", to, detail: `Payment ${p.label ?? ""} → ${to}${to === "partial" ? ` (${paidAmount}/${p.amount})` : ""}` } });

  // Cascade: sync the linked invoice; on first full payment, send confirmation + invoice emails.
  const invoice = await syncInvoiceWithPayment(p.id);
  if (becamePaid) {
    const enr = await prisma.enrollment.findUnique({ where: { id: p.enrollmentId }, include: { athlete: true, academy: true, package: true } });
    if (enr) {
      const ctx = { academyName: enr.academy.name, athleteName: `${enr.athlete.firstName} ${enr.athlete.lastName}`, packageName: enr.package?.name ?? null, amount: p.amount, currency: p.currency, invoiceNumber: invoice?.number ?? null };
      await notify({ academyId, type: "payment_confirmation", toEmail: enr.athlete.email, toName: ctx.athleteName, enrollmentId: enr.id, ctx });
      await notify({ academyId, type: "invoice_available", toEmail: enr.athlete.email, toName: ctx.athleteName, enrollmentId: enr.id, ctx });
    }
  }

  revalidateOps(p.enrollmentId);
  return { ok: true };
}

export async function updateDocument(documentId: string, status: string, expiresAt?: string, fileUrl?: string): Promise<ActionResult> {
  const parsed = documentUpdateSchema.safeParse({ documentId, status, expiresAt, fileUrl });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const academyId = await requireAcademyId();
  const d = await prisma.document.findFirst({ where: { id: parsed.data.documentId, academyId } });
  if (!d) return { ok: false, error: "Not found" };

  await prisma.document.update({
    where: { id: d.id },
    data: {
      status: parsed.data.status,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      fileUrl: parsed.data.fileUrl ?? (parsed.data.status === "missing" ? null : d.fileUrl ?? "https://example.com/doc.pdf"),
    },
  });
  await prisma.enrollmentEvent.create({ data: { enrollmentId: d.enrollmentId, type: "document", to: parsed.data.status, detail: `Document ${d.type} → ${parsed.data.status}` } });
  revalidateOps(d.enrollmentId);
  return { ok: true };
}

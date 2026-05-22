import { prisma } from "@/lib/db";
import { resolveRequiredDocs, buildPaymentSchedule } from "@/lib/enrollmentLogic";
import { createInvoiceForPayment } from "@/lib/invoices";
import { notify } from "@/lib/notifications";
import { isExternalFinance } from "@/lib/finance";

type EnrollOpts = { packageId?: string | null; groupId?: string | null; coachId?: string | null };

// Automation: turning an accepted application into an active athlete.
// Idempotent — safe to call more than once for the same application.
// `opts` lets the acceptance-confirmation modal override package/group/coach.
export async function enrollAcceptedApplication(applicationId: string, opts: EnrollOpts = {}) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { package: true, enrollment: true, athlete: true, academy: true },
  });
  if (!app) return null;
  if (app.enrollment) {
    // Already enrolled — apply any new assignments from the confirmation modal.
    const data: EnrollOpts = {};
    if (opts.packageId !== undefined) data.packageId = opts.packageId;
    if (opts.groupId !== undefined) data.groupId = opts.groupId;
    if (opts.coachId !== undefined) data.coachId = opts.coachId;
    if (Object.keys(data).length) await prisma.enrollment.update({ where: { id: app.enrollment.id }, data });
    return app.enrollment;
  }

  const joinDate = new Date();
  const packageId = opts.packageId !== undefined ? opts.packageId : app.packageId;
  // Default the group to the auto-placement computed at intake (Smart Group Assignment)
  // when the accept flow didn't pick one — e.g. a quick drag-to-accept on the board.
  const groupId = opts.groupId !== undefined ? opts.groupId : (app.suggestedGroupId ?? null);

  const enrollment = await prisma.enrollment.create({
    data: {
      academyId: app.academyId,
      athleteId: app.athleteId,
      applicationId: app.id,
      packageId,
      groupId,
      coachId: opts.coachId ?? null,
      status: "active",
      joinDate,
    },
  });

  await prisma.enrollmentEvent.create({
    data: { enrollmentId: enrollment.id, type: "created", to: "active", detail: "Active athlete created from accepted application" },
  });

  // Auto-generate the payment schedule from the chosen package — but ONLY when LEAF
  // manages billing. If the academy reads finance from an external gestionale, LEAF is
  // read-only: invoices/payments are synced from that system, never generated here.
  const pkg = packageId ? await prisma.package.findUnique({ where: { id: packageId } }) : null;
  if (pkg?.price && !isExternalFinance(app.academy.financeProvider)) {
    const schedule = buildPaymentSchedule({ price: pkg.price, currency: pkg.currency, billingFreq: pkg.billingFreq, joinDate });
    for (const p of schedule) {
      const payment = await prisma.payment.create({
        data: { academyId: app.academyId, enrollmentId: enrollment.id, label: p.label, amount: p.amount, currency: p.currency, dueDate: p.dueDate, status: "unpaid" },
      });
      await createInvoiceForPayment(payment); // invoice generated with the schedule
    }
    await prisma.enrollmentEvent.create({ data: { enrollmentId: enrollment.id, type: "payment", detail: `Payment schedule + invoices created (${schedule.length})` } });
  }

  // Required documents — per-academy config (falls back to the platform default).
  for (const type of resolveRequiredDocs(app.academy.requiredDocs)) {
    await prisma.document.create({ data: { academyId: app.academyId, enrollmentId: enrollment.id, type, status: "missing", required: true } });
  }

  // Connect the application thread to the new athlete (history preserved) + system note.
  const conv = await prisma.conversation.findUnique({ where: { applicationId: app.id } });
  if (conv) {
    await prisma.conversation.update({ where: { id: conv.id }, data: { enrollmentId: enrollment.id, type: "athlete" } });
    await prisma.message.create({ data: { conversationId: conv.id, senderSide: "system", senderRole: "system", senderName: "System", body: "Application accepted — welcome! This thread now continues as your athlete chat." } });
  }

  // Automatic emails.
  const ctx = { academyName: app.academy.name, athleteName: `${app.athlete.firstName} ${app.athlete.lastName}`, packageName: pkg?.name ?? null };
  await notify({ academyId: app.academyId, type: "application_accepted", toEmail: app.athlete.email, toName: ctx.athleteName, applicationId: app.id, enrollmentId: enrollment.id, ctx });
  await notify({ academyId: app.academyId, type: "enrollment_confirmed", toEmail: app.athlete.email, toName: ctx.athleteName, applicationId: app.id, enrollmentId: enrollment.id, ctx });

  return enrollment;
}

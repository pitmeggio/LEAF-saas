import { prisma } from "@/lib/db";
import { fmtMoney } from "@/lib/domain";

// Email/notification automation. Real SMTP is out of scope for the MVP, so each
// "email" is rendered from a default template and recorded as a Notification row
// (an outbox). Templates are centralised here so academy admins can edit them later.

export type NotifType =
  | "thanks_for_applying"
  | "application_accepted"
  | "application_rejected"
  | "missing_documents"
  | "payment_reminder"
  | "payment_confirmation"
  | "invoice_available"
  | "enrollment_confirmed";

export const NOTIF_LABEL: Record<NotifType, string> = {
  thanks_for_applying: "Thanks for applying",
  application_accepted: "Application accepted",
  application_rejected: "Application update",
  missing_documents: "Missing documents reminder",
  payment_reminder: "Payment reminder",
  payment_confirmation: "Payment confirmation",
  invoice_available: "Invoice available",
  enrollment_confirmed: "Enrollment confirmed",
};

export type NotifCtx = {
  academyName: string;
  athleteName: string;
  packageName?: string | null;
  amount?: number | null;
  currency?: string;
  invoiceNumber?: string | null;
  missingCount?: number;
  dueDate?: string;
};

function render(type: NotifType, c: NotifCtx): { subject: string; body: string } {
  const money = c.amount != null ? fmtMoney(c.amount, c.currency ?? "EUR") : "";
  switch (type) {
    case "thanks_for_applying":
      return {
        subject: `We received your application — ${c.academyName}`,
        body: `Hi ${c.athleteName},\n\nThanks for applying to ${c.academyName}. Our coaching staff will review your profile${c.packageName ? ` for the ${c.packageName} program` : ""} and get back to you shortly.\n\n— ${c.academyName}`,
      };
    case "application_accepted":
      return {
        subject: `Congratulations — you're accepted at ${c.academyName}!`,
        body: `Hi ${c.athleteName},\n\nGreat news — your application to ${c.academyName} has been accepted${c.packageName ? ` for the ${c.packageName} package` : ""}.\n\nNext steps:\n1. Complete your required documents (medical certificate, liability waiver, academy contract, race license).\n2. Review your payment schedule.\n3. Your coach will be in touch about your training group.\n\nWelcome to the team!\n— ${c.academyName}`,
      };
    case "application_rejected":
      return {
        subject: `Your application to ${c.academyName}`,
        body: `Hi ${c.athleteName},\n\nThank you for your interest in ${c.academyName} and for taking the time to apply. After careful review, we're unable to offer you a place this season. We genuinely wish you the best with your racing and hope our paths cross again.\n\n— ${c.academyName}`,
      };
    case "missing_documents":
      return {
        subject: `Action needed: ${c.missingCount ?? "some"} document(s) outstanding`,
        body: `Hi ${c.athleteName},\n\nTo complete your enrollment at ${c.academyName}, please upload your outstanding document(s) (${c.missingCount ?? ""} remaining). You can do this from your athlete portal.\n\n— ${c.academyName}`,
      };
    case "payment_reminder":
      return {
        subject: `Payment reminder — ${c.academyName}`,
        body: `Hi ${c.athleteName},\n\nThis is a friendly reminder that a payment of ${money}${c.dueDate ? ` (due ${c.dueDate})` : ""} is outstanding for your ${c.packageName ?? "program"} at ${c.academyName}. Please arrange payment at your earliest convenience.\n\n— ${c.academyName}`,
      };
    case "payment_confirmation":
      return {
        subject: `Payment received — thank you`,
        body: `Hi ${c.athleteName},\n\nWe've received your payment of ${money} for ${c.packageName ?? "your program"} at ${c.academyName}. Thank you!\n\n— ${c.academyName}`,
      };
    case "invoice_available":
      return {
        subject: `Invoice ${c.invoiceNumber ?? ""} available`,
        body: `Hi ${c.athleteName},\n\nYour invoice ${c.invoiceNumber ?? ""} (${money}) for ${c.packageName ?? "your program"} at ${c.academyName} is now available in your portal.\n\n— ${c.academyName}`,
      };
    case "enrollment_confirmed":
      return {
        subject: `You're enrolled at ${c.academyName}`,
        body: `Hi ${c.athleteName},\n\nYour enrollment at ${c.academyName}${c.packageName ? ` (${c.packageName})` : ""} is confirmed. Your payment schedule and document checklist are ready in your portal. See you on snow!\n\n— ${c.academyName}`,
      };
  }
}

export async function notify(opts: {
  academyId: string;
  type: NotifType;
  toEmail?: string | null;
  toName?: string | null;
  applicationId?: string | null;
  enrollmentId?: string | null;
  ctx: NotifCtx;
}) {
  const { subject, body } = render(opts.type, opts.ctx);
  await prisma.notification.create({
    data: {
      academyId: opts.academyId,
      type: opts.type,
      toEmail: opts.toEmail ?? null,
      toName: opts.toName ?? null,
      subject,
      body,
      status: "sent",
      applicationId: opts.applicationId ?? null,
      enrollmentId: opts.enrollmentId ?? null,
    },
  });
}

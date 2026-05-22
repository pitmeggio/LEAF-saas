import { prisma } from "@/lib/db";
import { getFinanceProvider } from "./index";
import type { ExternalInvoice } from "./types";

export type SyncResult = {
  ok: boolean;
  error?: string;
  fetched?: number; // invoices returned by the provider
  matched?: number; // invoices matched to a known enrollment
  unmatched?: number; // invoices whose customer id we don't know yet
};

function paymentStatus(inv: ExternalInvoice): string {
  if (inv.status === "paid") return "paid";
  if (inv.status === "partial") return "partial";
  return "unpaid"; // unpaid | cancelled both surface as not-collected at the payment level
}

function invoiceStatus(inv: ExternalInvoice): string {
  switch (inv.status) {
    case "paid": return "paid";
    case "partial": return "partial";
    case "cancelled": return "cancelled";
    default: return "sent";
  }
}

// Pull invoice/payment data from the academy's connected finance provider and mirror
// it into LEAF's Payment + Invoice tables (tagged source="external"), matched to
// enrollments by externalCustomerId. Idempotent: re-running updates existing rows
// (keyed by externalId) rather than duplicating. LEAF never writes back to the source.
export async function syncAcademyFinance(academyId: string): Promise<SyncResult> {
  const academy = await prisma.academy.findUnique({ where: { id: academyId } });
  if (!academy) return { ok: false, error: "Academy not found." };

  const provider = getFinanceProvider(academy.financeProvider);
  if (!provider) return { ok: false, error: "No external finance provider connected." };

  // Build the external-customer → enrollment map (only enrollments that have been mapped).
  const enrollments = await prisma.enrollment.findMany({
    where: { academyId, externalCustomerId: { not: null } },
    select: { id: true, externalCustomerId: true },
  });
  const byCustomer = new Map<string, string>();
  for (const e of enrollments) if (e.externalCustomerId) byCustomer.set(e.externalCustomerId, e.id);

  const config =
    academy.financeConfig && typeof academy.financeConfig === "object" && !Array.isArray(academy.financeConfig)
      ? (academy.financeConfig as Record<string, unknown>)
      : null;

  let invoices: ExternalInvoice[];
  try {
    invoices = await provider.fetchInvoices(config, { customerIds: [...byCustomer.keys()] });
  } catch (err) {
    return { ok: false, error: `Provider error: ${(err as Error).message}` };
  }

  let matched = 0;
  let unmatched = 0;
  for (const inv of invoices) {
    const enrollmentId = byCustomer.get(inv.customerId);
    if (!enrollmentId) { unmatched++; continue; }
    matched++;

    // Upsert the Payment mirror (drives collected / outstanding / overdue analytics).
    const existingPayment = await prisma.payment.findFirst({
      where: { academyId, source: "external", externalId: inv.externalId },
    });
    const paymentData = {
      academyId,
      enrollmentId,
      label: `Invoice ${inv.number}`,
      amount: inv.amount,
      paidAmount: inv.paidAmount,
      currency: inv.currency,
      dueDate: inv.dueDate ?? inv.issuedAt,
      paidDate: inv.paidAt,
      status: paymentStatus(inv),
      source: "external",
      externalId: inv.externalId,
    };
    const payment = existingPayment
      ? await prisma.payment.update({ where: { id: existingPayment.id }, data: paymentData })
      : await prisma.payment.create({ data: paymentData });

    // Upsert the Invoice mirror (drives invoice counts / states).
    const existingInvoice = await prisma.invoice.findFirst({
      where: { academyId, source: "external", externalId: inv.externalId },
    });
    const invoiceData = {
      academyId,
      enrollmentId,
      paymentId: payment.id,
      number: inv.number,
      amount: inv.amount,
      currency: inv.currency,
      status: invoiceStatus(inv),
      issuedAt: inv.issuedAt,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      source: "external",
      externalId: inv.externalId,
    };
    if (existingInvoice) {
      await prisma.invoice.update({ where: { id: existingInvoice.id }, data: invoiceData });
    } else {
      await prisma.invoice.create({ data: invoiceData });
    }
  }

  await prisma.academy.update({ where: { id: academyId }, data: { financeSyncedAt: new Date() } });
  return { ok: true, fetched: invoices.length, matched, unmatched };
}

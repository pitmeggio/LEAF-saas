import { prisma } from "@/lib/db";

export async function nextInvoiceNumber(academyId: string): Promise<string> {
  const count = await prisma.invoice.count({ where: { academyId } });
  return `INV-2627-${String(count + 1).padStart(4, "0")}`;
}

// Create an invoice for a freshly-scheduled payment (status "pending").
// Called when a payment schedule is generated, so every payment has an invoice.
export async function createInvoiceForPayment(payment: { id: string; academyId: string; enrollmentId: string; amount: number; currency: string }) {
  const existing = await prisma.invoice.findUnique({ where: { paymentId: payment.id } });
  if (existing) return existing;
  return prisma.invoice.create({
    data: {
      academyId: payment.academyId,
      enrollmentId: payment.enrollmentId,
      paymentId: payment.id,
      number: await nextInvoiceNumber(payment.academyId),
      amount: payment.amount,
      currency: payment.currency,
      status: "pending",
    },
  });
}

// Keep the invoice state in sync with its payment's state. Returns the invoice.
export async function syncInvoiceWithPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return null;
  let inv = await prisma.invoice.findUnique({ where: { paymentId } });
  if (!inv) {
    inv = await createInvoiceForPayment(payment);
  }
  const status = payment.status === "paid" ? "paid" : payment.status === "partial" ? "partial" : inv.status === "sent" ? "sent" : "pending";
  return prisma.invoice.update({
    where: { id: inv.id },
    data: { status, amount: payment.amount, paidAt: payment.status === "paid" ? (payment.paidDate ?? new Date()) : null },
  });
}

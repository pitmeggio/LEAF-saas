"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createStripeCheckout, paymentsConfigured, appBaseUrl } from "@/lib/payments/stripe";

type Result = { ok: true; url?: string } | { ok: false; error: string };

const KINDS = ["camp_reg", "court_booking"] as const;
type Kind = (typeof KINDS)[number];

// Resolve a payable item to its amount + customer, tenant-scoped.
async function loadPayable(kind: Kind, refId: string, academyId: string) {
  if (kind === "camp_reg") {
    const r = await prisma.tennisCampRegistration.findFirst({
      where: { id: refId, camp: { academyId } },
      select: { id: true, parentName: true, parentEmail: true, childName: true, paidAmount: true, camp: { select: { name: true, price: true, currency: true } } },
    });
    if (!r) return null;
    return { amount: r.camp?.price ?? 0, paidAmount: r.paidAmount, currency: r.camp?.currency ?? "EUR",
      description: `${r.camp?.name ?? "Camp"} — ${r.childName}`, customerEmail: r.parentEmail, customerName: r.parentName };
  }
  const b = await prisma.courtBooking.findFirst({
    where: { id: refId, academyId },
    select: { id: true, label: true, customerName: true, customerEmail: true, publicPrice: true, paidAmount: true },
  });
  if (!b) return null;
  return { amount: b.publicPrice ?? 0, paidAmount: b.paidAmount, currency: "EUR",
    description: b.label ?? "Prenotazione campo", customerEmail: b.customerEmail, customerName: b.customerName };
}

function rev() { revalidatePath("/dashboard/payments-essential"); revalidatePath("/dashboard/camps"); revalidatePath("/dashboard/courts"); }

// Create (or reuse) a Stripe Checkout link for a payable. Apple Pay shows up
// automatically in the hosted page on eligible devices.
export async function createCheckoutLink(kind: Kind, refId: string): Promise<Result> {
  if (!KINDS.includes(kind)) return { ok: false, error: "Tipo non valido." };
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  if (!paymentsConfigured()) return { ok: false, error: "Stripe non collegato. Incolla la chiave STRIPE_SECRET_KEY per attivare i pagamenti online." };

  const item = await loadPayable(kind, refId, s.academyId);
  if (!item) return { ok: false, error: "Voce non trovata." };
  const due = Math.max(0, item.amount - item.paidAmount);
  if (due <= 0) return { ok: false, error: "Già pagato." };

  const checkout = await prisma.essentialCheckout.create({
    data: { academyId: s.academyId, kind, refId, amount: due, currency: item.currency,
      description: item.description, customerEmail: item.customerEmail, customerName: item.customerName, status: "pending" },
  });

  try {
    const session = await createStripeCheckout({
      amount: due, currency: item.currency, description: item.description, customerEmail: item.customerEmail,
      successUrl: `${appBaseUrl()}/pagamento/ok`, cancelUrl: `${appBaseUrl()}/pagamento/annullato`,
      metadata: { checkoutId: checkout.id, kind, refId, academyId: s.academyId },
    });
    if (!session) return { ok: false, error: "Stripe non collegato." };
    await prisma.essentialCheckout.update({ where: { id: checkout.id }, data: { stripeSessionId: session.id, url: session.url } });
    rev();
    return { ok: true, url: session.url };
  } catch {
    await prisma.essentialCheckout.delete({ where: { id: checkout.id } }).catch(() => {});
    return { ok: false, error: "Errore nella creazione del pagamento. Verifica le chiavi Stripe." };
  }
}

// Mark a payable collected offline (cash / bank) — no gateway needed.
export async function markPaidManual(kind: Kind, refId: string): Promise<Result> {
  if (!KINDS.includes(kind)) return { ok: false, error: "Tipo non valido." };
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  const item = await loadPayable(kind, refId, s.academyId);
  if (!item) return { ok: false, error: "Voce non trovata." };

  if (kind === "camp_reg") {
    await prisma.tennisCampRegistration.update({ where: { id: refId }, data: { paidAmount: item.amount, status: "confirmed" } });
  } else {
    await prisma.courtBooking.update({ where: { id: refId }, data: { paidAmount: item.amount } });
  }
  await prisma.essentialCheckout.create({
    data: { academyId: s.academyId, kind, refId, amount: item.amount, currency: item.currency,
      description: item.description, customerEmail: item.customerEmail, customerName: item.customerName,
      status: "manual", provider: "manual", paidAt: new Date() },
  });
  rev();
  return { ok: true };
}

export async function unmarkPaid(kind: Kind, refId: string): Promise<Result> {
  if (!KINDS.includes(kind)) return { ok: false, error: "Tipo non valido." };
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  if (kind === "camp_reg") {
    await prisma.tennisCampRegistration.updateMany({ where: { id: refId, camp: { academyId: s.academyId } }, data: { paidAmount: 0 } });
  } else {
    await prisma.courtBooking.updateMany({ where: { id: refId, academyId: s.academyId }, data: { paidAmount: 0 } });
  }
  await prisma.essentialCheckout.deleteMany({ where: { academyId: s.academyId, kind, refId, provider: "manual" } });
  rev();
  return { ok: true };
}

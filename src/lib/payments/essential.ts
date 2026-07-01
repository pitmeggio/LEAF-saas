import { prisma } from "@/lib/db";

// Every payable item in the Essential workspace: camp registrations and
// priced court bookings. One shape so the Pagamenti page can list them all,
// show paid / to-pay, and (with Stripe) attach a payment link.

export type PayableKind = "camp_reg" | "court_booking";

export type Payable = {
  kind: PayableKind;
  refId: string;
  title: string;
  subtitle: string | null;
  customerName: string | null;
  customerEmail: string | null;
  amount: number;        // total price, major units
  paidAmount: number;
  currency: string;
  paid: boolean;
  date: string;          // ISO
  checkoutUrl: string | null;  // a still-open Stripe link, if any
};

export type EssentialPayments = {
  items: Payable[];
  collected: number;
  outstanding: number;
  currency: string;
  paymentsConfigured: boolean;
};

export async function getEssentialPayments(academyId: string, configured: boolean): Promise<EssentialPayments> {
  const [academy, campRegs, courtBookings, checkouts] = await Promise.all([
    prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } }),
    prisma.tennisCampRegistration.findMany({
      where: { camp: { academyId }, status: { not: "cancelled" } },
      select: { id: true, parentName: true, parentEmail: true, childName: true, paidAmount: true, createdAt: true,
        camp: { select: { name: true, price: true, currency: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.courtBooking.findMany({
      where: { academyId, publicPrice: { not: null, gt: 0 } },
      select: { id: true, label: true, customerName: true, customerEmail: true, publicPrice: true, paidAmount: true, startAt: true },
      orderBy: { startAt: "desc" },
    }),
    prisma.essentialCheckout.findMany({ where: { academyId, status: "pending" }, select: { kind: true, refId: true, url: true } }),
  ]);

  const currency = academy?.currency ?? "EUR";
  const openLink = new Map<string, string>();
  for (const c of checkouts) if (c.url) openLink.set(`${c.kind}:${c.refId}`, c.url);

  const items: Payable[] = [];
  for (const r of campRegs) {
    const amount = r.camp?.price ?? 0;
    items.push({
      kind: "camp_reg", refId: r.id,
      title: r.camp?.name ?? "Camp", subtitle: `Iscrizione · ${r.childName}`,
      customerName: r.parentName, customerEmail: r.parentEmail,
      amount, paidAmount: r.paidAmount, currency: r.camp?.currency ?? currency,
      paid: amount > 0 && r.paidAmount >= amount,
      date: r.createdAt.toISOString(),
      checkoutUrl: openLink.get(`camp_reg:${r.id}`) ?? null,
    });
  }
  for (const b of courtBookings) {
    const amount = b.publicPrice ?? 0;
    items.push({
      kind: "court_booking", refId: b.id,
      title: b.label ?? "Prenotazione campo", subtitle: "Prenotazione campo",
      customerName: b.customerName, customerEmail: b.customerEmail,
      amount, paidAmount: b.paidAmount, currency,
      paid: amount > 0 && b.paidAmount >= amount,
      date: b.startAt.toISOString(),
      checkoutUrl: openLink.get(`court_booking:${b.id}`) ?? null,
    });
  }
  items.sort((a, b) => (a.paid === b.paid ? b.date.localeCompare(a.date) : a.paid ? 1 : -1));

  const collected = items.reduce((s, i) => s + i.paidAmount, 0);
  const outstanding = items.reduce((s, i) => s + Math.max(0, i.amount - i.paidAmount), 0);

  return { items, collected, outstanding, currency, paymentsConfigured: configured };
}

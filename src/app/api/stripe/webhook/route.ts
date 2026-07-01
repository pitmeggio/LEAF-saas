import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/payments/stripe";

// Stripe posts here when a payment completes. We verify the signature, then
// flip the EssentialCheckout + its source item (camp registration / court
// booking) to paid. Needs STRIPE_WEBHOOK_SECRET (from the Stripe dashboard).
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Payments not configured" }, { status: 400 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string; metadata?: Record<string, string> | null };
    const meta = session.metadata ?? {};
    const checkoutId = meta.checkoutId;
    const kind = meta.kind;
    const refId = meta.refId;
    const academyId = meta.academyId;

    if (checkoutId && kind && refId && academyId) {
      const checkout = await prisma.essentialCheckout.findFirst({ where: { id: checkoutId, academyId }, select: { id: true, amount: true, status: true } });
      if (checkout && checkout.status !== "paid") {
        await prisma.essentialCheckout.update({ where: { id: checkout.id }, data: { status: "paid", paidAt: new Date(), stripeSessionId: session.id } });
        if (kind === "camp_reg") {
          const reg = await prisma.tennisCampRegistration.findFirst({ where: { id: refId, camp: { academyId } }, select: { camp: { select: { price: true } } } });
          await prisma.tennisCampRegistration.updateMany({ where: { id: refId, camp: { academyId } }, data: { paidAmount: reg?.camp?.price ?? checkout.amount, status: "confirmed" } });
        } else if (kind === "court_booking") {
          const b = await prisma.courtBooking.findFirst({ where: { id: refId, academyId }, select: { publicPrice: true } });
          await prisma.courtBooking.updateMany({ where: { id: refId, academyId }, data: { paidAmount: b?.publicPrice ?? checkout.amount } });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}

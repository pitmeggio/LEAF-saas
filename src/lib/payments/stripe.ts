import Stripe from "stripe";

// LEAF payments seam — Stripe only for now. Apple Pay / Google Pay are enabled
// automatically by Stripe Checkout on eligible devices (Stripe also registers
// the Apple Pay domain for Checkout-hosted pages, so there's no merchant-ID
// setup to do by hand). The whole thing lights up the moment STRIPE_SECRET_KEY
// is set — until then getStripe() returns null and the UI shows "collega Stripe".

export function paymentsConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let _stripe: Stripe | null = null;
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3500").replace(/\/$/, "");
}

export type CheckoutInput = {
  amount: number;        // major units (EUR)
  currency: string;      // "eur"
  description: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
};

// Create a Stripe Checkout Session. Wallets (Apple Pay/Google Pay) + cards are
// offered automatically by Checkout — we don't pin payment_method_types.
export async function createStripeCheckout(input: CheckoutInput): Promise<{ id: string; url: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: Math.round(input.amount * 100),
          product_data: { name: input.description },
        },
      },
    ],
    customer_email: input.customerEmail || undefined,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: input.metadata,
  });
  if (!session.url) return null;
  return { id: session.id, url: session.url };
}

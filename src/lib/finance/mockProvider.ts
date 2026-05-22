import type { ExternalInvoice, FinanceProvider, FinanceFetchContext, FinanceConfig } from "./types";

// Deterministic mock connector — the "simulated provider" analogue of the FIS seam.
// It fabricates a believable invoice history for each known customer id so the whole
// sync → analytics path can be exercised before a real connector exists.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

// Generate 3 seasonal installments per customer with a deterministic paid/unpaid mix.
function invoicesForCustomer(customerId: string, currency: string): ExternalInvoice[] {
  const h = hash(customerId);
  const base = 1200 + (h % 5) * 300; // 1200–2400
  const per = Math.round(base / 3);
  const out: ExternalInvoice[] = [];
  for (let i = 0; i < 3; i++) {
    const issued = daysAgo(150 - i * 50);
    const due = daysAgo(120 - i * 50);
    // installment 1 paid; 2 depends on hash; 3 usually open
    const paidRoll = (h >> i) % 3;
    const isPaid = i === 0 || (i === 1 && paidRoll !== 0);
    const isPartial = !isPaid && i === 1 && paidRoll === 0;
    const amount = i === 2 ? base - per * 2 : per;
    out.push({
      externalId: `MOCK-${customerId}-${i + 1}`,
      customerId,
      number: `${2627}-${(h % 9000) + 1000}-${i + 1}`,
      amount,
      paidAmount: isPaid ? amount : isPartial ? Math.round(amount / 2) : 0,
      currency,
      status: isPaid ? "paid" : isPartial ? "partial" : "unpaid",
      issuedAt: issued,
      dueDate: due,
      paidAt: isPaid ? daysAgo(118 - i * 50) : null,
    });
  }
  return out;
}

export const mockFinanceProvider: FinanceProvider = {
  key: "mock",
  label: "Demo connector (mock)",
  async fetchInvoices(config: FinanceConfig, ctx: FinanceFetchContext): Promise<ExternalInvoice[]> {
    const currency = (config && typeof config === "object" && typeof (config as Record<string, unknown>).currency === "string"
      ? ((config as Record<string, unknown>).currency as string)
      : "EUR");
    // Use the customer ids LEAF knows about so the synced data is matchable.
    const ids = ctx.customerIds.length ? ctx.customerIds : ["DEMO-1", "DEMO-2", "DEMO-3"];
    return ids.flatMap((id) => invoicesForCustomer(id, currency));
  },
};

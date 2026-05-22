// Pure finance aggregation — no DB. Aggregates payments PER CURRENCY so amounts in
// different currencies are never summed together (LEAF goes international: each
// academy operates in its own base currency, but a tenant may still hold a few
// records in another currency). Headline figures are reported in the academy's base
// currency; anything else is segregated into `otherCurrencies`. Unit-tested.

export type PaymentLike = {
  amount: number; // total billed, currency major units
  paidAmount: number; // collected so far
  currency: string;
  dueDate: Date;
  paidDate: Date | null;
  status: string; // unpaid | paid | partial
};

export type CurrencyFinance = {
  currency: string;
  collected: number;
  billed: number;
  outstanding: number; // billed but not collected (open payments)
  overdue: number; // outstanding past due date
  paidThisMonth: number;
  monthlyRecurring: number; // real: trailing 3-month average of collected cash
  collectionRate: number; // 0–100
};

export type FinanceAggregate = {
  currency: string; // academy base currency
  collected: number;
  billed: number;
  outstandingTotal: number;
  overdueTotal: number;
  paidThisMonth: number;
  monthlyRecurring: number;
  collectionRate: number;
  byCurrency: CurrencyFinance[]; // every currency present, base first
  otherCurrencies: CurrencyFinance[]; // non-base buckets only
};

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isPaymentOverdue(p: PaymentLike, now: Date): boolean {
  return p.status !== "paid" && +p.dueDate < +now && p.amount - p.paidAmount > 0;
}

function emptyBucket(currency: string): CurrencyFinance {
  return { currency, collected: 0, billed: 0, outstanding: 0, overdue: 0, paidThisMonth: 0, monthlyRecurring: 0, collectionRate: 100 };
}

export function aggregateFinance(payments: PaymentLike[], opts: { baseCurrency: string; now?: Date }): FinanceAggregate {
  const now = opts.now ?? new Date();
  const base = opts.baseCurrency;
  const ninetyAgo = +now - 90 * 24 * 3600 * 1000;

  const buckets = new Map<string, CurrencyFinance>();
  const trailing90 = new Map<string, number>(); // collected in last 90d, per currency
  const get = (c: string) => {
    let b = buckets.get(c);
    if (!b) { b = emptyBucket(c); buckets.set(c, b); }
    return b;
  };

  for (const p of payments) {
    const b = get(p.currency);
    const open = p.amount - p.paidAmount;
    b.collected += p.paidAmount;
    b.billed += p.amount;
    if (p.status !== "paid") b.outstanding += open;
    if (isPaymentOverdue(p, now)) b.overdue += open;
    if (p.paidDate && sameMonth(p.paidDate, now)) b.paidThisMonth += p.paidAmount;
    if (p.paidDate && +p.paidDate >= ninetyAgo) trailing90.set(p.currency, (trailing90.get(p.currency) ?? 0) + p.paidAmount);
  }

  for (const b of buckets.values()) {
    b.monthlyRecurring = Math.round((trailing90.get(b.currency) ?? 0) / 3);
    b.collectionRate = b.billed > 0 ? Math.round((b.collected / b.billed) * 100) : 100;
  }

  // Ensure the base currency always has a bucket (zeros) so headline figures exist.
  if (!buckets.has(base)) buckets.set(base, emptyBucket(base));

  const all = [...buckets.values()].sort((a, b) =>
    a.currency === base ? -1 : b.currency === base ? 1 : b.collected - a.collected,
  );
  const baseBucket = buckets.get(base)!;
  const otherCurrencies = all.filter((b) => b.currency !== base && (b.billed > 0 || b.collected > 0));

  return {
    currency: base,
    collected: baseBucket.collected,
    billed: baseBucket.billed,
    outstandingTotal: baseBucket.outstanding,
    overdueTotal: baseBucket.overdue,
    paidThisMonth: baseBucket.paidThisMonth,
    monthlyRecurring: baseBucket.monthlyRecurring,
    collectionRate: baseBucket.collectionRate,
    byCurrency: all,
    otherCurrencies,
  };
}

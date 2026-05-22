// Pure, DB-free enrollment automation logic.
// Imported by BOTH the app (enrollment service) and prisma/seed.ts, so it must not
// import the db client or any "@/..." alias — keep it dependency-free.

export const REQUIRED_DOC_TYPES = [
  "medical_certificate",
  "liability_waiver",
  "academy_contract",
  "race_license",
] as const;

export const OPTIONAL_DOC_TYPES = ["travel", "parent_approval", "internal"] as const;

export const ALL_DOC_TYPES = [...REQUIRED_DOC_TYPES, ...OPTIONAL_DOC_TYPES] as const;

// Resolve an academy's required-document set from its config string (comma/newline
// separated keys). Falls back to the platform default when unset. Per-tenant config,
// not hardcoded — academies choose which documents they require.
export function resolveRequiredDocs(raw?: string | null): string[] {
  if (!raw) return [...REQUIRED_DOC_TYPES];
  const known = new Set<string>(ALL_DOC_TYPES);
  const picked = raw.split(/[\n,]/).map((s) => s.trim()).filter((t) => known.has(t));
  return picked.length ? picked : [...REQUIRED_DOC_TYPES];
}

export const DOC_LABEL: Record<string, string> = {
  medical_certificate: "Medical certificate",
  liability_waiver: "Liability waiver",
  academy_contract: "Academy contract",
  race_license: "Race license",
  travel: "Travel documents",
  parent_approval: "Parent approval",
  internal: "Internal document",
};

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export type ScheduledPayment = { label: string; amount: number; currency: string; dueDate: Date };

// Generates a payment schedule from a package's billing config. Automation-first:
// selecting a package determines the schedule, no manual entry.
export function buildPaymentSchedule(opts: {
  price: number | null | undefined;
  currency: string;
  billingFreq: string; // one_time | monthly | seasonal
  joinDate: Date;
}): ScheduledPayment[] {
  const { price, currency, billingFreq, joinDate } = opts;
  if (!price || price <= 0) return [];

  if (billingFreq === "monthly") {
    const n = 6; // a 6-month season
    return Array.from({ length: n }, (_, i) => ({
      label: `Month ${i + 1}/${n}`,
      amount: price,
      currency,
      dueDate: addMonths(joinDate, i),
    }));
  }

  if (billingFreq === "seasonal") {
    const n = 3; // 3 installments across the season
    const per = Math.round(price / n);
    return Array.from({ length: n }, (_, i) => ({
      label: `Installment ${i + 1}/${n}`,
      amount: i === n - 1 ? price - per * (n - 1) : per,
      currency,
      dueDate: addMonths(joinDate, i * 2),
    }));
  }

  // one_time
  return [{ label: "Full payment", amount: price, currency, dueDate: joinDate }];
}

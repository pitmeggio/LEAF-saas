// Pure, DB-free accounting helpers for the expense module — the PowerOffice
// replacement layer. Imported by BOTH the dashboard forms (presets) and the
// server-side export (CSV / printable report), so it must stay dependency-free.

// ── VAT (MVA / IVA) rate presets, by country ───────────────────────────────
// Norway MVA: 25 standard · 15 food · 12 transport & lodging · 0 exempt.
// Italy IVA: 22 standard · 10 reduced · 4 super-reduced · 0 exempt.
const VAT_PRESETS: Record<string, number[]> = {
  NO: [25, 15, 12, 0],
  IT: [22, 10, 4, 0],
};
const VAT_DEFAULT = [25, 12, 0];

// Resolve the country code from an academy.country value (we store free text
// like "Norway" / "NO" / "Italy"). Keep it forgiving.
export function countryCode(country?: string | null): string {
  const c = (country ?? "").trim().toUpperCase();
  if (c === "NO" || c.startsWith("NOR")) return "NO";
  if (c === "IT" || c.startsWith("ITAL")) return "IT";
  return c.slice(0, 2);
}

export function vatRatesForCountry(country?: string | null): number[] {
  return VAT_PRESETS[countryCode(country)] ?? VAT_DEFAULT;
}

export function vatLabel(country?: string | null): string {
  return countryCode(country) === "IT" ? "IVA" : "MVA";
}

// ── Gross → net + VAT scorporo ─────────────────────────────────────────────
// Receipts are VAT-inclusive (gross). Back the VAT out of the gross amount.
// Amounts are integer major units (whole NOK / EUR). vatRate is a percent.
export function splitVat(gross: number, vatRate: number | null | undefined): { net: number; vat: number } {
  const rate = vatRate ?? 0;
  if (rate <= 0) return { net: gross, vat: 0 };
  const net = Math.round(gross / (1 + rate / 100));
  return { net, vat: gross - net };
}

// ── Mileage (kjøregodtgjørelse) ────────────────────────────────────────────
// Default tax-free rate per km, in MINOR units (e.g. 350 = NOK 3.50/km — the
// Norwegian skattefri sats). Stored per expense so it survives rate changes.
const MILEAGE_RATE_CENTS: Record<string, number> = { NO: 350, IT: 20 };
export function defaultMileageRateCents(country?: string | null): number {
  return MILEAGE_RATE_CENTS[countryCode(country)] ?? 20;
}

// gross amount (major units) for a mileage trip = round(km × rate).
export function mileageAmount(distanceKm: number, ratePerKmCents: number): number {
  return Math.round((distanceKm * ratePerKmCents) / 100);
}

// ── Chart of accounts (kontonummer) presets ────────────────────────────────
// A pragmatic subset relevant to a sports academy. Free-text on the expense, so
// an academy on a different chart can override per line — these just guide.
export const ACCOUNT_CODES: { code: string; label: string }[] = [
  { code: "4300", label: "Equipment / clothing" },
  { code: "5000", label: "Coaching / wages" },
  { code: "6300", label: "Facility rent" },
  { code: "6800", label: "Office supplies" },
  { code: "7100", label: "Mileage allowance" },
  { code: "7140", label: "Travel" },
  { code: "7160", label: "Per diem / meals" },
  { code: "7320", label: "Marketing" },
  { code: "7700", label: "Other operating cost" },
];

// Category → sensible default account code + VAT rate. The form pre-fills these
// when a category is picked; the user can still override.
const CATEGORY_DEFAULTS: Record<string, { account: string; vat: number }> = {
  coaching: { account: "5000", vat: 0 },
  housing: { account: "7140", vat: 12 },
  accommodation: { account: "7140", vat: 12 },
  hotel: { account: "7140", vat: 12 },
  lift_pass: { account: "7140", vat: 12 },
  fuel: { account: "7140", vat: 25 },
  transport: { account: "7140", vat: 12 },
  travel: { account: "7140", vat: 12 },
  equipment: { account: "4300", vat: 25 },
  race_cost: { account: "7140", vat: 0 },
  sport_ops: { account: "7700", vat: 25 },
  other: { account: "7700", vat: 25 },
};
export function categoryDefaults(category: string, country?: string | null): { account: string; vat: number } {
  const base = CATEGORY_DEFAULTS[category] ?? { account: "7700", vat: 25 };
  // Clamp the default VAT to a rate that actually exists for the country.
  const rates = vatRatesForCountry(country);
  const vat = rates.includes(base.vat) ? base.vat : (rates.find((r) => r > 0) ?? 0);
  return { account: base.account, vat };
}

// ── Payment methods ────────────────────────────────────────────────────────
export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "private_outlay", label: "Private outlay (reimburse coach)" },
  { value: "company_card", label: "Company card" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer / invoice" },
];

// ── CSV export ─────────────────────────────────────────────────────────────
// RFC-4180-ish: quote fields containing comma/quote/newline, double internal quotes.
export function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

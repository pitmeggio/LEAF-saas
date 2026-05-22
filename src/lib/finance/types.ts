// External finance integration — the seam over an academy's existing billing /
// gestionale software. LEAF reads invoice + payment data and analyses it; it never
// issues invoices. New connectors (Fatture in Cloud, TeamSystem, Stripe, QuickBooks,
// Xero, sport systems…) implement FinanceProvider behind this same interface, exactly
// like the FisProvider seam in lib/fis/.

export type ExternalInvoiceStatus = "paid" | "partial" | "unpaid" | "cancelled";

// A normalised invoice as LEAF understands it, regardless of source system.
export type ExternalInvoice = {
  externalId: string; // stable id of the invoice in the source system
  customerId: string; // external customer id → matched to Enrollment.externalCustomerId
  number: string; // human-facing invoice number
  amount: number; // total, in currency major units
  paidAmount: number; // collected so far, major units
  currency: string;
  status: ExternalInvoiceStatus;
  issuedAt: Date;
  dueDate: Date | null;
  paidAt: Date | null;
};

// Stored per academy in Academy.financeConfig (non-secret connection settings).
export type FinanceConfig = Record<string, unknown> | null | undefined;

// Context the sync layer hands the provider (e.g. which customers LEAF knows about).
// Real providers can ignore it (they fetch everything); the mock uses it to fabricate
// matchable demo data.
export type FinanceFetchContext = { customerIds: string[] };

export interface FinanceProvider {
  key: string;
  label: string;
  fetchInvoices(config: FinanceConfig, ctx: FinanceFetchContext): Promise<ExternalInvoice[]>;
}

export type FinanceProviderInfo = {
  key: string;
  label: string;
  available: boolean; // false = listed in UI but not yet implemented ("coming soon")
};

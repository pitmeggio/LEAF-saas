import type { FinanceProvider, FinanceProviderInfo } from "./types";
import { mockFinanceProvider } from "./mockProvider";

export type { ExternalInvoice, ExternalInvoiceStatus, FinanceConfig, FinanceProvider } from "./types";

// Implemented fetch connectors, keyed by Academy.financeProvider.
const PROVIDERS: Record<string, FinanceProvider> = {
  mock: mockFinanceProvider,
};

// Catalogue shown in the dashboard connection UI. `available: false` entries are
// roadmap connectors — visible so academies see what's coming, not yet selectable.
export const FINANCE_PROVIDERS: FinanceProviderInfo[] = [
  { key: "mock", label: "Demo connector (mock data)", available: true },
  { key: "csv", label: "CSV / spreadsheet import", available: false },
  { key: "fattureincloud", label: "Fatture in Cloud", available: false },
  { key: "teamsystem", label: "TeamSystem / Danea", available: false },
  { key: "stripe", label: "Stripe", available: false },
  { key: "quickbooks", label: "QuickBooks", available: false },
  { key: "xero", label: "Xero", available: false },
];

export function getFinanceProvider(key: string | null | undefined): FinanceProvider | null {
  if (!key) return null;
  return PROVIDERS[key] ?? null;
}

// True when the academy reads finance from an external system (LEAF is read-only and
// must NOT auto-generate its own invoices/payments).
export function isExternalFinance(provider: string | null | undefined): boolean {
  return !!provider && provider !== "leaf";
}

export function financeProviderLabel(key: string | null | undefined): string {
  if (!key) return "LEAF-managed";
  return FINANCE_PROVIDERS.find((p) => p.key === key)?.label ?? key;
}

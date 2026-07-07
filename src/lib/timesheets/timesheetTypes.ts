// Client-safe types + labels for Foglio ore & Stipendi. No prisma import.

export type TimesheetStatus = "draft" | "submitted" | "approved" | "paid";

export const TS_STATUS_META: Record<TimesheetStatus, { label: string; color: string }> = {
  draft: { label: "Bozza", color: "#8a93a6" },
  submitted: { label: "Inviato", color: "#f5a623" },
  approved: { label: "Approvato", color: "#3ecf8e" },
  paid: { label: "Pagato", color: "#7c9cff" },
};

// amount override wins; else hours × hourlyRate; else null (unknown pay).
export function computeAmount(hours: number, hourlyRate: number | null, override: number | null): number | null {
  if (override != null) return override;
  if (hourlyRate != null) return Math.round(hours * hourlyRate);
  return null;
}

export type TimesheetView = {
  id: string;
  coachId: string;
  coachName: string;
  period: string;
  hours: number;
  hourlyRate: number | null;
  amount: number | null; // resolved pay (override or hours×rate)
  currency: string;
  status: TimesheetStatus;
  note: string | null;
  hasFile: boolean;
  fileName: string | null;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
};

// "2026-07" → "Luglio 2026". Falls back to the raw label for free-text periods.
const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
export function periodLabel(period: string): string {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) return period;
  const mi = Number(m[2]) - 1;
  return `${MONTHS[mi] ?? m[2]} ${m[1]}`;
}

export const STATUSES = ["new", "reviewing", "shortlisted", "accepted", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  accepted: "Accepted",
  rejected: "Rejected",
};

export const STATUS_COLOR: Record<Status, string> = {
  new: "#38bdf8",
  reviewing: "#f59e0b",
  shortlisted: "#a78bfa",
  accepted: "#7CFF6B",
  rejected: "#f87171",
};

export const DISCIPLINE_LABEL: Record<string, string> = {
  slalom: "Slalom",
  giant_slalom: "Giant Slalom",
  super_g: "Super-G",
  downhill: "Downhill",
  all_round: "All-Round",
};

export const COUNTRY: Record<string, { name: string; flag: string }> = {
  IT: { name: "Italy", flag: "🇮🇹" },
  NO: { name: "Norway", flag: "🇳🇴" },
  AT: { name: "Austria", flag: "🇦🇹" },
  SE: { name: "Sweden", flag: "🇸🇪" },
  FI: { name: "Finland", flag: "🇫🇮" },
  CH: { name: "Switzerland", flag: "🇨🇭" },
  SI: { name: "Slovenia", flag: "🇸🇮" },
};

export function age(dob: Date): number {
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export function initials(first: string, last: string): string {
  return (first[0] ?? "") + (last[0] ?? "");
}

// FIS points: lower is better. A drop in points = improvement = positive trend.
export type Trend = { deltaPoints: number; pct: number; direction: "up" | "down" | "flat" };

export function trendFromPoints(start: number, end: number): Trend {
  const deltaPoints = start - end; // positive = improved
  const pct = start > 0 ? (deltaPoints / start) * 100 : 0;
  const direction = Math.abs(pct) < 1.5 ? "flat" : deltaPoints > 0 ? "up" : "down";
  return { deltaPoints: round(deltaPoints), pct: round(pct), direction };
}

export function round(n: number, p = 1): number {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

export function fmtPoints(p: number | null | undefined): string {
  return p == null ? "—" : String(p);
}

export function fmtMoney(amount: number | null | undefined, currency = "EUR"): string {
  if (amount == null) return "—";
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " ";
  return `${symbol}${amount.toLocaleString("en-US")}`;
}

// ── Enrollment (active athlete) status ──
export const ENROLLMENT_STATUSES = ["active", "paused", "injured", "completed", "inactive"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const ENROLLMENT_STATUS_COLOR: Record<string, string> = {
  active: "#7CFF6B",
  paused: "#f59e0b",
  injured: "#f87171",
  completed: "#38bdf8",
  inactive: "#8a93a6",
};

export const LEVEL_LABEL: Record<string, string> = {
  development: "Development",
  competitive: "Competitive",
  elite: "Elite",
};

// ── Performance status (derived from FIS-points trend) ──
export type PerfStatus = "improving" | "stable" | "declining";

export function perfFromTrend(t: Trend): PerfStatus {
  if (t.direction === "up") return "improving";
  if (t.direction === "down") return "declining";
  return "stable";
}

export const PERF_COLOR: Record<PerfStatus, string> = {
  improving: "#7CFF6B",
  stable: "#8a93a6",
  declining: "#f87171",
};

// ── Payments ──
export function isOverdue(p: { status: string; dueDate: Date | string }): boolean {
  return p.status !== "paid" && new Date(p.dueDate).getTime() < Date.now();
}

export function effectivePaymentStatus(p: { status: string; dueDate: Date | string }): string {
  if (p.status === "paid") return "paid";
  if (isOverdue(p)) return "overdue";
  return p.status; // unpaid | partial
}

export const PAYMENT_STATUS_COLOR: Record<string, string> = {
  paid: "#7CFF6B",
  unpaid: "#8a93a6",
  partial: "#f59e0b",
  overdue: "#f87171",
};

// Invoice display status — overdue is derived from the linked payment's due date.
export function effectiveInvoiceStatus(inv: { status: string }, payment?: { status: string; dueDate: Date | string } | null): string {
  if (inv.status === "paid" || inv.status === "cancelled") return inv.status;
  if (inv.status === "partial") return "partial"; // partial is meaningful even when past due
  if (payment && isOverdue(payment)) return "overdue";
  return inv.status; // pending | sent
}

export const INVOICE_STATUS_COLOR: Record<string, string> = {
  pending: "#8a93a6",
  sent: "#38bdf8",
  partial: "#f59e0b",
  paid: "#7CFF6B",
  overdue: "#f87171",
  cancelled: "#8a93a6",
};

export const DOC_STATUS_COLOR: Record<string, string> = {
  verified: "#7CFF6B",
  uploaded: "#38bdf8",
  missing: "#f87171",
  expired: "#f59e0b",
};

export function isThisMonth(d: Date | string): boolean {
  const x = new Date(d);
  const now = new Date();
  return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear();
}

export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function relativeDate(d: Date | string): string {
  const days = Math.round((Date.now() - new Date(d).getTime()) / (24 * 3600 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

import { prisma } from "@/lib/db";
import { computeAmount, type TimesheetStatus, type TimesheetView } from "./timesheetTypes";

// Server read layer for Foglio ore & Stipendi.

// Additive table — until pushed it doesn't exist. Degrade to empty so pages
// (coach dashboard, finance) never break pre-push.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const code = (e as { code?: string })?.code;
    const msg = (e as { message?: string })?.message ?? "";
    if (code === "P2021" || code === "P2022" || /does not exist/i.test(msg)) return fallback;
    throw e;
  }
}

type Row = {
  id: string; coachId: string; coachName: string; period: string; hours: number;
  hourlyRate: number | null; amount: number | null; currency: string; status: string;
  note: string | null; fileName: string | null; createdAt: Date; approvedAt: Date | null; paidAt: Date | null;
};

function toView(r: Row): TimesheetView {
  return {
    id: r.id, coachId: r.coachId, coachName: r.coachName, period: r.period, hours: r.hours,
    hourlyRate: r.hourlyRate, amount: computeAmount(r.hours, r.hourlyRate, r.amount),
    currency: r.currency, status: (r.status as TimesheetStatus) ?? "submitted", note: r.note,
    hasFile: !!r.fileName, fileName: r.fileName,
    createdAt: r.createdAt.toISOString(), approvedAt: r.approvedAt?.toISOString() ?? null, paidAt: r.paidAt?.toISOString() ?? null,
  };
}

const SELECT = {
  id: true, coachId: true, coachName: true, period: true, hours: true, hourlyRate: true,
  amount: true, currency: true, status: true, note: true, fileName: true, createdAt: true, approvedAt: true, paidAt: true,
} as const;

// A coach's own timesheets, newest period first.
export async function getCoachTimesheets(coachId: string): Promise<TimesheetView[]> {
  const rows = await safe(
    () => prisma.timesheet.findMany({ where: { coachId }, orderBy: [{ period: "desc" }, { createdAt: "desc" }], select: SELECT }),
    [] as Row[],
  );
  return rows.map(toView);
}

export type AcademyTimesheets = {
  rows: TimesheetView[];
  byCoach: { coachId: string; coachName: string; hours: number; amount: number; count: number; unpaid: number }[];
  totalHours: number;
  totalAmount: number;
  unpaidAmount: number; // approved-but-not-paid + submitted
  pendingApproval: number;
};

// Academy-wide view for admin/office — every coach's foglio ore + salary rollup.
export async function getAcademyTimesheets(academyId: string): Promise<AcademyTimesheets> {
  const raw = await safe(
    () => prisma.timesheet.findMany({ where: { academyId }, orderBy: [{ period: "desc" }, { createdAt: "desc" }], select: SELECT }),
    [] as Row[],
  );
  const rows = raw.map(toView);

  const byCoachMap = new Map<string, { coachId: string; coachName: string; hours: number; amount: number; count: number; unpaid: number }>();
  for (const r of rows) {
    const e = byCoachMap.get(r.coachId) ?? { coachId: r.coachId, coachName: r.coachName, hours: 0, amount: 0, count: 0, unpaid: 0 };
    e.hours += r.hours;
    e.amount += r.amount ?? 0;
    e.count += 1;
    if (r.status !== "paid") e.unpaid += r.amount ?? 0;
    byCoachMap.set(r.coachId, e);
  }
  const byCoach = [...byCoachMap.values()].sort((a, b) => b.amount - a.amount);

  return {
    rows,
    byCoach,
    totalHours: rows.reduce((s, r) => s + r.hours, 0),
    totalAmount: rows.reduce((s, r) => s + (r.amount ?? 0), 0),
    unpaidAmount: rows.filter((r) => r.status !== "paid").reduce((s, r) => s + (r.amount ?? 0), 0),
    pendingApproval: rows.filter((r) => r.status === "submitted").length,
  };
}

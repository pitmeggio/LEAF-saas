import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import { computeTrend } from "@/lib/queries";
import { perfFromTrend, isOverdue, isThisMonth, type PerfStatus, type Trend } from "@/lib/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Operational data + automation. Everything here is COMPUTED from the database —
// occupancy, workload, revenue, overdue, missing docs, performance status, alerts.
// ─────────────────────────────────────────────────────────────────────────────

const ENROLLMENT_INCLUDE = {
  athlete: { include: { rankings: { orderBy: { date: "asc" as const } } } },
  coach: true,
  group: true,
  package: true,
  payments: true,
  documents: true,
  invoices: { orderBy: { issuedAt: "desc" as const } },
};

// Notifications (outbox) for an application or enrollment.
export async function getNotifications(where: { applicationId?: string; enrollmentId?: string }) {
  return prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 12 });
}

// Expenses — coach sees own (pass coachId), admin sees all.
export async function getExpenses(coachId?: string | null) {
  const academyId = await requireAcademyId();
  const expenses = await prisma.expense.findMany({
    where: { academyId, ...(coachId ? { coachId } : {}) },
    include: { coach: true, group: true },
    orderBy: { createdAt: "desc" },
  });
  const sum = (st: string[]) => expenses.filter((e) => st.includes(e.status)).reduce((s, e) => s + e.amount, 0);
  return {
    expenses,
    submittedTotal: sum(["submitted"]),
    approvedTotal: sum(["approved", "reimbursed"]),
    reimbursedTotal: sum(["reimbursed"]),
    pendingCount: expenses.filter((e) => e.status === "submitted").length,
  };
}

// Generic over the enrollment shape so the caller's full type (athlete fields,
// enrollment scalars, relations) flows through to the result unchanged — callers
// pass differently-shaped includes and rely on those extra fields downstream.
type EnrichInput = {
  athlete: { rankings: { date: Date; fisPoints: number }[] };
  payments: { status: string; dueDate: Date; amount: number; paidAmount: number }[];
  documents: { status: string; required: boolean }[];
};

export type EnrichedEnrollment = ReturnType<typeof enrichOne>;

function enrichOne<T extends EnrichInput>(e: T) {
  const trend = computeTrend(e.athlete.rankings);
  const perf: PerfStatus = perfFromTrend(trend);
  const overduePayments = e.payments.filter((p) => isOverdue(p));
  const overdueAmount = overduePayments.reduce((s, p) => s + (p.amount - p.paidAmount), 0);
  const missingDocs = e.documents.filter((d) => d.required && (d.status === "missing" || d.status === "expired"));
  const paymentsTotal = e.payments.reduce((s, p) => s + p.amount, 0);
  const paidTotal = e.payments.reduce((s, p) => s + p.paidAmount, 0);
  const outstanding = paymentsTotal - paidTotal;
  return { ...e, trend, perf, overduePayments, overdueAmount, missingDocs, paymentsTotal, paidTotal, outstanding };
}

async function loadEnrollments(academyId: string, coachId?: string | null) {
  const list = await prisma.enrollment.findMany({
    where: { academyId, ...(coachId ? { coachId } : {}) },
    include: ENROLLMENT_INCLUDE,
    orderBy: { joinDate: "desc" },
  });
  return list.map(enrichOne);
}

// `coachId` scopes results to a single coach's athletes (coach workspace).
export async function getActiveAthletes(coachId?: string | null) {
  const academyId = await requireAcademyId();
  return loadEnrollments(academyId, coachId);
}

export async function getActiveAthlete(id: string, coachId?: string | null) {
  const academyId = await requireAcademyId();
  const e = await prisma.enrollment.findFirst({
    where: { id, academyId, ...(coachId ? { coachId } : {}) },
    include: {
      ...ENROLLMENT_INCLUDE,
      athlete: { include: { rankings: { orderBy: { date: "asc" } }, results: { orderBy: { date: "desc" }, take: 6 }, media: true } },
      events: { orderBy: { createdAt: "desc" } },
      application: true,
      conversations: { select: { id: true }, take: 1 },
    },
  });
  if (!e) return null;
  const enriched = enrichOne(e);
  // team benchmark: average current FIS points of the athlete's group
  let teamAvg: number | null = null;
  if (e.groupId) {
    const peers = await prisma.enrollment.findMany({
      where: { academyId, groupId: e.groupId },
      include: { athlete: true },
    });
    const pts = peers.map((p) => p.athlete.fisPoints).filter((v): v is number => v != null);
    teamAvg = pts.length ? Math.round((pts.reduce((s, v) => s + v, 0) / pts.length) * 10) / 10 : null;
  }
  return { ...enriched, teamAvg };
}

// Lightweight {id,name} option lists for assignment dropdowns.
export async function getAssignmentOptions() {
  const academyId = await requireAcademyId();
  const [groups, coaches, packages, programs] = await Promise.all([
    prisma.group.findMany({ where: { academyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.coach.findMany({ where: { academyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.package.findMany({ where: { academyId }, select: { id: true, name: true, price: true, currency: true, billingFreq: true }, orderBy: { order: "asc" } }),
    prisma.program.findMany({ where: { academyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { groups, coaches, packages, programs };
}

export async function getGroupsWithStats(coachId?: string | null) {
  const academyId = await requireAcademyId();
  const groups = await prisma.group.findMany({
    where: { academyId, ...(coachId ? { coachId } : {}) },
    include: { coach: true, enrollments: { include: { package: true, payments: true } }, expenses: true },
    orderBy: { name: "asc" },
  });
  return groups.map((g) => {
    const count = g.enrollments.length;
    const revenue = g.enrollments.reduce((s, e) => s + (e.package?.price ?? 0), 0);
    // Collected revenue = amounts actually paid (incl. partials) across the group's payments.
    const collectedRevenue = g.enrollments.reduce((s, e) => s + e.payments.reduce((a, p) => a + p.paidAmount, 0), 0);
    const coachCost = g.coach?.cost ?? 0;
    const budget = g.budget ?? 0;
    // Margin = package revenue − coach cost − allocated operating budget.
    const margin = revenue - coachCost - budget;
    // Budget usage from coach expenses.
    const usedBudget = g.expenses.filter((e) => e.status === "approved" || e.status === "reimbursed").reduce((s, e) => s + e.amount, 0);
    const pendingExpenses = g.expenses.filter((e) => e.status === "submitted").reduce((s, e) => s + e.amount, 0);
    const remainingBudget = budget - usedBudget;
    return {
      ...g,
      count,
      occupancyPct: g.capacity > 0 ? Math.round((count / g.capacity) * 100) : 0,
      overCapacity: count > g.capacity,
      revenue,
      collectedRevenue,
      coachCost,
      budget,
      margin,
      marginPositive: margin >= 0,
      usedBudget,
      pendingExpenses,
      remainingBudget,
      overBudget: usedBudget > budget,
    };
  });
}

export async function getCoachesWithStats() {
  const academyId = await requireAcademyId();
  const coaches = await prisma.coach.findMany({
    where: { academyId },
    include: { groups: true, enrollments: true },
    orderBy: { name: "asc" },
  });
  return coaches.map((c) => {
    const athletes = c.enrollments.length;
    const groups = c.groups.length;
    // simple workload score: athletes weighted + groups
    const workload = athletes + groups * 2;
    return { ...c, athleteCount: athletes, groupCount: groups, workload };
  });
}

export async function getPackagesWithStats() {
  const academyId = await requireAcademyId();
  const packages = await prisma.package.findMany({
    where: { academyId },
    include: { enrollments: true },
    orderBy: { order: "asc" },
  });
  return packages.map((p) => {
    const active = p.enrollments.length;
    const contractValue = active * (p.price ?? 0);
    return {
      ...p,
      activeCount: active,
      occupancyPct: p.maxAthletes ? Math.round((active / p.maxAthletes) * 100) : null,
      full: p.maxAthletes != null && active >= p.maxAthletes,
      contractValue,
    };
  });
}

export type FinanceData = Awaited<ReturnType<typeof getFinance>>;

export async function getFinance() {
  const academyId = await requireAcademyId();
  const payments = await prisma.payment.findMany({
    where: { academyId },
    include: { enrollment: { include: { athlete: true, package: true, group: true } }, invoice: true },
    orderBy: { dueDate: "asc" },
  });

  const outstandingOf = (p: { amount: number; paidAmount: number }) => p.amount - p.paidAmount;
  const expectedThisMonth = payments.filter((p) => isThisMonth(p.dueDate)).reduce((s, p) => s + p.amount, 0);
  const paidThisMonth = payments.filter((p) => p.paidDate && isThisMonth(p.paidDate)).reduce((s, p) => s + p.amount, 0);
  const collected = payments.reduce((s, p) => s + p.paidAmount, 0);
  const outstandingTotal = payments.filter((p) => p.status !== "paid").reduce((s, p) => s + outstandingOf(p), 0);
  const overdue = payments.filter((p) => isOverdue(p));
  const overdueTotal = overdue.reduce((s, p) => s + outstandingOf(p), 0);
  const unpaidEnrollmentIds = new Set(overdue.map((p) => p.enrollmentId));

  // Invoice state counts (overdue derived from the linked payment due date).
  const invoiceStates = { pending: 0, sent: 0, partial: 0, paid: 0, overdue: 0, cancelled: 0 } as Record<string, number>;
  for (const p of payments) {
    const inv = p.invoice;
    if (!inv) continue;
    if (inv.status === "paid") invoiceStates.paid++;
    else if (inv.status === "cancelled") invoiceStates.cancelled++;
    else if (inv.status === "partial") invoiceStates.partial++;
    else if (isOverdue(p)) invoiceStates.overdue++;
    else if (inv.status === "sent") invoiceStates.sent++;
    else invoiceStates.pending++;
  }

  const activeSubs = await prisma.enrollment.count({ where: { academyId, status: { in: ["active", "injured", "paused"] }, packageId: { not: null } } });

  // package revenue breakdown (contract value of active enrollments)
  const pkgs = await getPackagesWithStats();
  const packageBreakdown = pkgs
    .filter((p) => p.activeCount > 0)
    .map((p) => ({ id: p.id, name: p.name, count: p.activeCount, revenue: p.contractValue, currency: p.currency }));

  // monthly recurring estimate: total contract value of active enrollments / 6 months
  const totalContract = pkgs.reduce((s, p) => s + p.contractValue, 0);
  const monthlyRecurringEstimate = Math.round(totalContract / 6);

  return {
    payments,
    expectedThisMonth,
    paidThisMonth,
    collected,
    outstandingTotal,
    overdue,
    overdueTotal,
    unpaidAthletes: unpaidEnrollmentIds.size,
    activeSubscriptions: activeSubs,
    packageBreakdown,
    monthlyRecurringEstimate,
    totalContract,
    invoiceStates,
  };
}

export async function getDocumentsData(coachId?: string | null) {
  const academyId = await requireAcademyId();
  const docs = await prisma.document.findMany({
    where: { academyId, ...(coachId ? { enrollment: { coachId } } : {}) },
    include: { enrollment: { include: { athlete: true } } },
    orderBy: { createdAt: "asc" },
  });
  const missing = docs.filter((d) => d.required && d.status === "missing");
  const expired = docs.filter((d) => d.status === "expired" || (d.expiresAt && new Date(d.expiresAt).getTime() < Date.now() && d.status !== "missing"));
  return { docs, missing, expired };
}

// ── Dashboard metrics ──
export async function getDashboard() {
  const academyId = await requireAcademyId();
  const [enrollments, applications, groups, coaches, finance, docs, alerts] = await Promise.all([
    getActiveAthletes(),
    prisma.application.findMany({ where: { academyId }, include: { athlete: { include: { rankings: { orderBy: { date: "asc" } } } } } }),
    getGroupsWithStats(),
    getCoachesWithStats(),
    getFinance(),
    getDocumentsData(),
    computeAlerts(),
  ]);

  const activeAthletes = enrollments.filter((e) => e.status === "active" || e.status === "injured" || e.status === "paused").length;
  const applicantsThisMonth = applications.filter((a) => isThisMonth(a.submittedAt)).length;
  const accepted = applications.filter((a) => a.status === "accepted").length;
  const improving = enrollments.filter((e) => e.perf === "improving").length;
  const totalCapacity = groups.reduce((s, g) => s + g.capacity, 0);
  const totalInGroups = groups.reduce((s, g) => s + g.count, 0);
  const occupancyPct = totalCapacity ? Math.round((totalInGroups / totalCapacity) * 100) : 0;

  return {
    activeAthletes,
    applicantsThisMonth,
    accepted,
    activeGroups: groups.filter((g) => g.active).length,
    coaches: coaches.length,
    occupancyPct,
    improving,
    totalActive: enrollments.length,
    finance,
    missingDocs: docs.missing.length,
    expiredDocs: docs.expired.length,
    alerts,
    enrollments,
  };
}

// ── Alerts (derived, automation-first) ──
export type Alert = {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  href?: string;
};

const WAITING_DAYS = 21;

export async function computeAlerts(coachId?: string | null): Promise<Alert[]> {
  const academyId = await requireAcademyId();
  const [enrollments, groups, packages, applications] = await Promise.all([
    loadEnrollments(academyId, coachId),
    getGroupsWithStats(coachId),
    coachId ? Promise.resolve([] as Awaited<ReturnType<typeof getPackagesWithStats>>) : getPackagesWithStats(),
    coachId ? Promise.resolve([] as { submittedAt: Date; id: string }[]) : prisma.application.findMany({ where: { academyId, status: { in: ["new", "reviewing"] } } }),
  ]);

  const alerts: Alert[] = [];

  for (const e of enrollments) {
    const name = `${e.athlete.firstName} ${e.athlete.lastName}`;
    if (e.overduePayments.length > 0) {
      alerts.push({ id: `pay-${e.id}`, type: "payment_overdue", severity: "high", title: "Payment overdue", detail: `${name} — ${e.overduePayments.length} overdue payment(s)`, href: `/members/${e.id}` });
    }
    if (e.missingDocs.length > 0) {
      alerts.push({ id: `doc-${e.id}`, type: "missing_document", severity: "medium", title: "Missing / expired documents", detail: `${name} — ${e.missingDocs.length} document(s) need attention`, href: `/members/${e.id}` });
    }
    if (e.perf === "declining") {
      alerts.push({ id: `perf-${e.id}`, type: "declining_trend", severity: "medium", title: "Declining performance", detail: `${name} — FIS trend is declining`, href: `/members/${e.id}` });
    }
    if (e.status === "inactive") {
      alerts.push({ id: `inact-${e.id}`, type: "inactive_athlete", severity: "low", title: "Inactive athlete", detail: `${name} is marked inactive`, href: `/members/${e.id}` });
    }
  }

  for (const g of groups) {
    if (g.overCapacity) {
      alerts.push({ id: `grp-${g.id}`, type: "group_over_capacity", severity: "medium", title: "Group over capacity", detail: `${g.name} — ${g.count}/${g.capacity} athletes`, href: `/groups` });
    }
  }

  for (const p of packages) {
    if (p.full) {
      alerts.push({ id: `pkg-${p.id}`, type: "package_full", severity: "low", title: "Package full", detail: `${p.name} reached ${p.activeCount}/${p.maxAthletes}`, href: `/packages` });
    }
  }

  for (const a of applications) {
    const days = Math.round((Date.now() - new Date(a.submittedAt).getTime()) / (24 * 3600 * 1000));
    if (days >= WAITING_DAYS) {
      alerts.push({ id: `app-${a.id}`, type: "application_waiting", severity: "medium", title: "Application waiting too long", detail: `An application has been waiting ${days} days`, href: `/applications/${a.id}` });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  return alerts.sort((x, y) => order[x.severity] - order[y.severity]);
}

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
      contracts: { orderBy: { createdAt: "desc" } },
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

// Groups (active) with their assignment rules + current active-enrollment load,
// shaped for the Smart Group Assignment recommender.
// Active groups for the attendance picker (coach sees only their groups).
export async function getAttendanceGroups(coachId?: string | null) {
  const academyId = await requireAcademyId();
  return prisma.group.findMany({
    where: { academyId, active: true, ...(coachId ? { coachId } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// Attendance board for a group: roster (active athletes), recent sessions with
// their records, and a per-athlete attendance rate. Coaches see only their groups.
export async function getAttendanceBoard(groupId: string, coachId?: string | null) {
  const academyId = await requireAcademyId();
  const group = await prisma.group.findFirst({
    where: { id: groupId, academyId, ...(coachId ? { coachId } : {}) },
    include: {
      enrollments: {
        where: { status: "active" },
        select: { id: true, athlete: { select: { firstName: true, lastName: true } } },
        orderBy: { athlete: { lastName: "asc" } },
      },
      sessions: {
        orderBy: { date: "desc" },
        take: 12,
        include: { attendance: { select: { enrollmentId: true, status: true } } },
      },
    },
  });
  if (!group) return null;

  const roster = group.enrollments.map((e) => ({ enrollmentId: e.id, name: `${e.athlete.firstName} ${e.athlete.lastName}` }));

  // Attendance rate per enrollment = present-or-late / sessions where a record exists.
  const rate = new Map<string, { present: number; total: number }>();
  for (const s of group.sessions) {
    for (const rec of s.attendance) {
      const r = rate.get(rec.enrollmentId) ?? { present: 0, total: 0 };
      r.total += 1;
      if (rec.status === "present" || rec.status === "late") r.present += 1;
      rate.set(rec.enrollmentId, r);
    }
  }

  return {
    group: { id: group.id, name: group.name },
    roster: roster.map((r) => {
      const ra = rate.get(r.enrollmentId);
      return { ...r, ratePct: ra && ra.total > 0 ? Math.round((ra.present / ra.total) * 100) : null, sessionsTracked: ra?.total ?? 0 };
    }),
    sessions: group.sessions.map((s) => ({
      id: s.id,
      date: s.date,
      title: s.title,
      records: Object.fromEntries(s.attendance.map((a) => [a.enrollmentId, a.status])),
    })),
  };
}

export async function getGroupsForAssignment() {
  const academyId = await requireAcademyId();
  const groups = await prisma.group.findMany({
    where: { academyId, active: true },
    include: {
      coach: { select: { name: true } },
      _count: { select: { enrollments: { where: { status: "active" } } } },
    },
    orderBy: { name: "asc" },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    sport: g.sport,
    capacity: g.capacity,
    enrolledCount: g._count.enrollments,
    pointsMin: g.pointsMin,
    pointsMax: g.pointsMax,
    ageMin: g.ageMin,
    ageMax: g.ageMax,
    discipline: g.discipline,
    level: g.level,
    coachName: g.coach?.name ?? null,
  }));
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
      alerts.push({ id: `pay-${e.id}`, type: "payment_overdue", severity: "high", title: "Payment overdue", detail: `${name} — ${e.overduePayments.length} overdue payment(s)`, href: `/dashboard/members/${e.id}` });
    }
    if (e.missingDocs.length > 0) {
      alerts.push({ id: `doc-${e.id}`, type: "missing_document", severity: "medium", title: "Missing / expired documents", detail: `${name} — ${e.missingDocs.length} document(s) need attention`, href: `/dashboard/members/${e.id}` });
    }
    if (e.perf === "declining") {
      alerts.push({ id: `perf-${e.id}`, type: "declining_trend", severity: "medium", title: "Declining performance", detail: `${name} — FIS trend is declining`, href: `/dashboard/members/${e.id}` });
    }
    if (e.status === "inactive") {
      alerts.push({ id: `inact-${e.id}`, type: "inactive_athlete", severity: "low", title: "Inactive athlete", detail: `${name} is marked inactive`, href: `/dashboard/members/${e.id}` });
    }
  }

  for (const g of groups) {
    if (g.overCapacity) {
      alerts.push({ id: `grp-${g.id}`, type: "group_over_capacity", severity: "medium", title: "Group over capacity", detail: `${g.name} — ${g.count}/${g.capacity} athletes`, href: `/dashboard/groups` });
    }
  }

  for (const p of packages) {
    if (p.full) {
      alerts.push({ id: `pkg-${p.id}`, type: "package_full", severity: "low", title: "Package full", detail: `${p.name} reached ${p.activeCount}/${p.maxAthletes}`, href: `/dashboard/packages` });
    }
  }

  for (const a of applications) {
    const days = Math.round((Date.now() - new Date(a.submittedAt).getTime()) / (24 * 3600 * 1000));
    if (days >= WAITING_DAYS) {
      alerts.push({ id: `app-${a.id}`, type: "application_waiting", severity: "medium", title: "Application waiting too long", detail: `An application has been waiting ${days} days`, href: `/dashboard/applications/${a.id}` });
    }
  }

  // ── Contract intelligence: expiring soon + awaiting signature ──
  const now = Date.now();
  const in30d = now + 30 * 24 * 3600 * 1000;
  const contracts = await prisma.contract.findMany({
    where: { academyId, ...(coachId ? { enrollment: { coachId } } : {}) },
    include: { enrollment: { include: { athlete: { select: { firstName: true, lastName: true } } } } },
  });
  for (const c of contracts) {
    const nm = `${c.enrollment.athlete.firstName} ${c.enrollment.athlete.lastName}`;
    if (c.status === "signed" && c.endDate && +c.endDate >= now && +c.endDate <= in30d) {
      const days = Math.round((+c.endDate - now) / (24 * 3600 * 1000));
      alerts.push({ id: `ctr-exp-${c.id}`, type: "contract_expiring", severity: "medium", title: "Contract expiring", detail: `${nm} — "${c.title}" expires in ${days} day${days === 1 ? "" : "s"}`, href: `/dashboard/members/${c.enrollmentId}` });
    } else if ((c.status === "draft" || c.status === "sent")) {
      const ageDays = Math.round((now - +c.createdAt) / (24 * 3600 * 1000));
      if (ageDays >= 14) {
        alerts.push({ id: `ctr-sig-${c.id}`, type: "contract_unsigned", severity: "medium", title: "Contract awaiting signature", detail: `${nm} — "${c.title}" ${c.status} for ${ageDays} days`, href: `/dashboard/members/${c.enrollmentId}` });
      }
    }
  }

  // ── Attendance anomaly: low recent attendance rate ──
  const att = await prisma.attendance.findMany({
    where: { session: { academyId }, ...(coachId ? { enrollment: { coachId } } : {}) },
    include: { enrollment: { include: { athlete: { select: { firstName: true, lastName: true } } } }, session: { select: { date: true } } },
    orderBy: { session: { date: "desc" } },
    take: 2000,
  });
  const byEnr = new Map<string, { present: number; total: number; name: string }>();
  for (const a of att) {
    const r = byEnr.get(a.enrollmentId) ?? { present: 0, total: 0, name: `${a.enrollment.athlete.firstName} ${a.enrollment.athlete.lastName}` };
    if (r.total < 8) { // most recent 8 sessions per athlete
      r.total += 1;
      if (a.status === "present" || a.status === "late") r.present += 1;
      byEnr.set(a.enrollmentId, r);
    }
  }
  for (const [enrollmentId, r] of byEnr) {
    if (r.total >= 3) {
      const pct = Math.round((r.present / r.total) * 100);
      if (pct < 60) {
        alerts.push({ id: `att-${enrollmentId}`, type: "attendance_low", severity: pct < 40 ? "high" : "medium", title: "Low attendance", detail: `${r.name} — ${pct}% across the last ${r.total} sessions`, href: `/dashboard/members/${enrollmentId}` });
      }
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  return alerts.sort((x, y) => order[x.severity] - order[y.severity]);
}

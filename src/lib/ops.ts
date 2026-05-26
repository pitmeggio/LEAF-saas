import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import { computeTrend } from "@/lib/queries";
import { perfFromTrend, isOverdue, isThisMonth, type PerfStatus, type Trend } from "@/lib/domain";
import { aggregateFinance } from "@/lib/financeMath";
import { seasonBounds, previousSeason } from "@/lib/season";

// Shared option bag for "what season am I looking at?". All read functions
// accept this and narrow their result set accordingly — pages just pass the
// season they got from the cookie. Omitting it keeps the all-time behaviour.
export type SeasonScope = { season?: string };
function dateInWindow(d: Date | null | undefined, start: Date, end: Date) {
  if (!d) return false;
  const t = +d;
  return t >= +start && t <= +end;
}

// ─────────────────────────────────────────────────────────────────────────────
// Operational data + automation. Everything here is COMPUTED from the database —
// occupancy, workload, revenue, overdue, missing docs, performance status, alerts.
// ─────────────────────────────────────────────────────────────────────────────

// "Current roster" statuses — the athletes that count toward live occupancy,
// revenue, workload and capacity. Churned/finished athletes are excluded so the
// analytics reflect the academy as it is now, not its entire history.
const ACTIVE_ENROLLMENT_STATUSES = new Set(["active", "injured", "paused"]);
const isActiveEnrollment = (status: string) => ACTIVE_ENROLLMENT_STATUSES.has(status);

const ENROLLMENT_INCLUDE = {
  athlete: { include: { rankings: { orderBy: { date: "asc" as const } } } },
  coach: true,
  group: true,
  package: true,
  payments: true,
  documents: true,
  invoices: { orderBy: { issuedAt: "desc" as const } },
};

// The academy's base/operating currency — drives all money formatting.
export async function getAcademyCurrency(): Promise<string> {
  const academyId = await requireAcademyId();
  const a = await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } });
  return a?.currency ?? "EUR";
}

// Notifications (outbox) for an application or enrollment.
export async function getNotifications(where: { applicationId?: string; enrollmentId?: string }) {
  return prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 12 });
}

// Expenses — coach sees own (pass coachId), admin sees all.
export async function getExpenses(coachId?: string | null) {
  const academyId = await requireAcademyId();
  const expenses = await prisma.expense.findMany({
    where: { academyId, ...(coachId ? { coachId } : {}) },
    include: { coach: true, group: true, approvedBy: { select: { name: true } } },
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

async function loadEnrollments(academyId: string, coachId?: string | null, opts: SeasonScope = {}) {
  // Season scoping for enrollments — an enrollment belongs to a season via its
  // group. We deliberately include enrollments without a group (intake limbo)
  // only when no season filter is active, so the season view stays focused on
  // the rostered athletes for that season.
  const list = await prisma.enrollment.findMany({
    where: {
      academyId,
      ...(coachId ? { coachId } : {}),
      ...(opts.season ? { group: { season: opts.season } } : {}),
    },
    include: ENROLLMENT_INCLUDE,
    orderBy: { joinDate: "desc" },
  });
  return list.map(enrichOne);
}

// `coachId` scopes results to a single coach's athletes (coach workspace).
// `opts.season` narrows to athletes rostered in that season's groups.
export async function getActiveAthletes(coachId?: string | null, opts: SeasonScope = {}) {
  const academyId = await requireAcademyId();
  return loadEnrollments(academyId, coachId, opts);
}

export async function getActiveAthlete(id: string, coachId?: string | null) {
  const academyId = await requireAcademyId();
  const e = await prisma.enrollment.findFirst({
    where: { id, academyId, ...(coachId ? { coachId } : {}) },
    include: {
      ...ENROLLMENT_INCLUDE,
      // 60 results is enough for full per-discipline breakdown + 2-3 seasons
      // of historical analytics. The recent-6 view in the UI is just sliced.
      athlete: { include: { rankings: { orderBy: { date: "asc" } }, results: { orderBy: { date: "desc" }, take: 60 }, media: true } },
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

// `opts.season` restricts to groups whose `season` field matches — Groups
// already live in exactly one season per the schema (group.season is required),
// so scoping is a simple equality filter.
export async function getGroupsWithStats(coachId?: string | null, opts: SeasonScope = {}) {
  const academyId = await requireAcademyId();
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } });
  const baseCurrency = academy?.currency ?? "EUR";
  const groups = await prisma.group.findMany({
    where: {
      academyId,
      ...(coachId ? { coachId } : {}),
      ...(opts.season ? { season: opts.season } : {}),
    },
    include: { coach: true, enrollments: { include: { package: true, payments: true, athlete: { select: { discipline: true } } } }, expenses: true },
    orderBy: { name: "asc" },
  });
  return groups.map((g) => {
    // Live roster only — churned/finished athletes don't count toward occupancy or revenue.
    const roster = g.enrollments.filter((e) => isActiveEnrollment(e.status));
    const count = roster.length;
    const revenue = roster.reduce((s, e) => s + (e.package?.price ?? 0), 0);
    // Discipline split — how the live roster is composed (SL / GS / SG / DH …).
    const discMap = new Map<string, number>();
    for (const e of roster) {
      const d = e.athlete?.discipline?.toUpperCase() || "—";
      discMap.set(d, (discMap.get(d) ?? 0) + 1);
    }
    const disciplineSplit = [...discMap.entries()]
      .map(([discipline, n]) => ({ discipline, count: n, pct: count > 0 ? Math.round((n / count) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
    // Collected revenue = amounts actually paid (incl. partials) across the roster's payments.
    const collectedRevenue = roster.reduce((s, e) => s + e.payments.reduce((a, p) => a + p.paidAmount, 0), 0);
    const coachCost = g.coach?.cost ?? 0;
    const budget = g.budget ?? 0;
    // Margin = package revenue − coach cost − allocated operating budget.
    const margin = revenue - coachCost - budget;
    // Budget usage from coach expenses — only expenses in the academy's base currency
    // count against its (national-currency) budget. Foreign-currency expenses (e.g. a
    // trip abroad) are still tracked + reimbursed, but excluded here to avoid mixing
    // currencies (converting them would need FX rates we don't hold yet).
    const baseExpenses = g.expenses.filter((e) => e.currency === baseCurrency);
    const approvedExpenses = baseExpenses.filter((e) => e.status === "approved" || e.status === "reimbursed");
    const usedBudget = approvedExpenses.reduce((s, e) => s + e.amount, 0);
    const pendingExpenses = baseExpenses.filter((e) => e.status === "submitted").reduce((s, e) => s + e.amount, 0);
    const foreignExpenseCount = g.expenses.length - baseExpenses.length;
    const remainingBudget = budget - usedBudget;
    const pctUsed = budget > 0 ? Math.round((usedBudget / budget) * 100) : 0;
    // Monthly burn rate = approved spend in the last 30 days (base currency).
    const since30 = Date.now() - 30 * 24 * 3600 * 1000;
    const monthlyBurnRate = approvedExpenses
      .filter((e) => +(e.expenseDate ?? e.createdAt) >= since30)
      .reduce((s, e) => s + e.amount, 0);
    // Spend broken down by cost line (category) — the "budget per voci" view.
    const byCat = new Map<string, number>();
    for (const e of approvedExpenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
    const categoryBreakdown = [...byCat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
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
      foreignExpenseCount,
      pctUsed,
      monthlyBurnRate,
      categoryBreakdown,
      disciplineSplit,
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
    const athletes = c.enrollments.filter((e) => isActiveEnrollment(e.status)).length;
    const groups = c.groups.length;
    // simple workload score: athletes weighted + groups
    const workload = athletes + groups * 2;
    return { ...c, athleteCount: athletes, groupCount: groups, workload };
  });
}

// When `opts.season` is set we still load every Package (they're shared across
// seasons), but the per-package `activeCount` only counts enrollments rostered
// in that season's groups — so "active in season X" is honest.
export async function getPackagesWithStats(opts: SeasonScope = {}) {
  const academyId = await requireAcademyId();
  const packages = await prisma.package.findMany({
    where: { academyId },
    include: {
      enrollments: opts.season
        ? { where: { group: { season: opts.season } } }
        : true,
    },
    orderBy: { order: "asc" },
  });
  return packages.map((p) => {
    const active = p.enrollments.filter((e) => isActiveEnrollment(e.status)).length;
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

// `opts.season` scopes the entire finance picture to a single season:
//   – payments included only if dueDate OR paidDate falls in the season window
//   – activeSubscriptions / packageBreakdown / totalContract counted only for
//     enrollments rostered in that season's groups
// Omit `opts.season` to keep the historical (all-time) behaviour.
export async function getFinance(opts: SeasonScope = {}) {
  const academyId = await requireAcademyId();
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } });
  const baseCurrency = academy?.currency ?? "EUR";
  const bounds = opts.season ? seasonBounds(opts.season) : null;

  // Pull all matching payments — when scoped, we ask Postgres for "anything that
  // touched the season" (due in window OR paid in window) so a payment created
  // before the season but paid inside it still counts as season revenue.
  const payments = await prisma.payment.findMany({
    where: {
      academyId,
      ...(bounds
        ? {
            OR: [
              { dueDate: { gte: bounds.start, lte: bounds.end } },
              { paidDate: { gte: bounds.start, lte: bounds.end } },
            ],
          }
        : {}),
    },
    include: { enrollment: { include: { athlete: true, package: true, group: true } }, invoice: true },
    orderBy: { dueDate: "asc" },
  });

  // Currency-correct aggregation: amounts are summed per currency, headline in base.
  const agg = aggregateFinance(
    payments.map((p) => ({ amount: p.amount, paidAmount: p.paidAmount, currency: p.currency, dueDate: p.dueDate, paidDate: p.paidDate, status: p.status })),
    { baseCurrency },
  );
  const collected = agg.collected;
  const outstandingTotal = agg.outstandingTotal;
  const overdueTotal = agg.overdueTotal;
  const monthlyRecurring = agg.monthlyRecurring;
  // "paid this month" stays calendar-current; when a past season is selected,
  // the page surfaces "paid in season" (sum of paidAmount on payments paid in
  // window) instead — computed here so the page doesn't have to.
  const paidInSeason = bounds
    ? payments
        .filter((p) => p.currency === baseCurrency && dateInWindow(p.paidDate, bounds.start, bounds.end))
        .reduce((s, p) => s + p.paidAmount, 0)
    : agg.paidThisMonth;

  const expectedThisMonth = payments.filter((p) => p.currency === baseCurrency && isThisMonth(p.dueDate)).reduce((s, p) => s + p.amount, 0);
  const overdue = payments.filter((p) => isOverdue(p));
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

  // Active subscriptions + package breakdown — when a season is in effect we
  // count only enrollments whose group is in that season, so the headline
  // "Active subscriptions" answers "how many athletes were on a package this
  // season", not "right now across all time".
  const activeSubs = await prisma.enrollment.count({
    where: {
      academyId,
      status: { in: ["active", "injured", "paused"] },
      packageId: { not: null },
      ...(opts.season ? { group: { season: opts.season } } : {}),
    },
  });
  const pkgs = await getPackagesWithStats(opts);
  const packageBreakdown = pkgs
    .filter((p) => p.activeCount > 0)
    .map((p) => ({ id: p.id, name: p.name, count: p.activeCount, revenue: p.contractValue, currency: p.currency }));
  const totalContract = pkgs.filter((p) => p.currency === baseCurrency).reduce((s, p) => s + p.contractValue, 0);

  return {
    payments,
    currency: baseCurrency,
    expectedThisMonth,
    paidThisMonth: paidInSeason,
    collected,
    outstandingTotal,
    overdue,
    overdueTotal,
    unpaidAthletes: unpaidEnrollmentIds.size,
    activeSubscriptions: activeSubs,
    packageBreakdown,
    monthlyRecurring,
    monthlyRecurringEstimate: monthlyRecurring, // back-compat alias
    totalContract,
    byCurrency: agg.byCurrency,
    otherCurrencies: agg.otherCurrencies,
    collectionRate: agg.collectionRate,
    invoiceStates,
    seasonScoped: !!opts.season,
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
// `opts.season` makes the entire overview season-scoped: enrolments, applications,
// groups, finance, budget rollup and the recent-activity feed all reflect the
// chosen season. Without it the dashboard falls back to the all-time view.
export async function getDashboard(opts: SeasonScope = {}) {
  const academyId = await requireAcademyId();
  const bounds = opts.season ? seasonBounds(opts.season) : null;
  const [enrollments, applications, groups, coaches, finance, docs, alerts] = await Promise.all([
    getActiveAthletes(null, opts),
    prisma.application.findMany({
      where: {
        academyId,
        ...(bounds ? { submittedAt: { gte: bounds.start, lte: bounds.end } } : {}),
      },
      include: { athlete: { include: { rankings: { orderBy: { date: "asc" } } } } },
    }),
    getGroupsWithStats(null, opts),
    getCoachesWithStats(),
    getFinance(opts),
    getDocumentsData(),
    computeAlerts(),
  ]);

  const activeAthletes = enrollments.filter((e) => e.status === "active" || e.status === "injured" || e.status === "paused").length;
  const applicantsThisMonth = applications.filter((a) => isThisMonth(a.submittedAt)).length;
  const accepted = applications.filter((a) => a.status === "accepted").length;
  // "Active applications" = anything still in the pipeline (not accepted / rejected).
  const pipelineCount = applications.filter((a) => a.status === "new" || a.status === "reviewing" || a.status === "shortlisted").length;
  const improving = enrollments.filter((e) => e.perf === "improving").length;
  const totalCapacity = groups.reduce((s, g) => s + g.capacity, 0);
  const totalInGroups = groups.reduce((s, g) => s + g.count, 0);
  const occupancyPct = totalCapacity ? Math.round((totalInGroups / totalCapacity) * 100) : 0;

  // Academy-wide budget rollup (base currency only — Groups.budget is in academy currency).
  const totalBudget = groups.reduce((s, g) => s + (g.budget ?? 0), 0);
  const usedBudget = groups.reduce((s, g) => s + g.usedBudget, 0);
  const budgetPctUsed = totalBudget > 0 ? Math.round((usedBudget / totalBudget) * 100) : 0;

  // Compact group distribution for the overview side panel.
  const groupDistribution = groups
    .filter((g) => g.active)
    .map((g) => ({ id: g.id, name: g.name, count: g.count, capacity: g.capacity, pct: g.occupancyPct }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Recent activity feed — most recent application status changes inside the
  // active season window when scoped, full history otherwise.
  const recentStatusEvents = await prisma.statusEvent.findMany({
    where: {
      application: { academyId },
      ...(bounds ? { createdAt: { gte: bounds.start, lte: bounds.end } } : {}),
    },
    include: { application: { include: { athlete: { select: { firstName: true, lastName: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const recentActivity = recentStatusEvents.map((e) => ({
    id: e.id,
    when: e.createdAt,
    title: `${e.application.athlete.firstName} ${e.application.athlete.lastName}`,
    detail: e.from ? `${e.from} → ${e.to}` : `Application ${e.to}`,
    href: `/dashboard/applications/${e.applicationId}`,
  }));

  return {
    activeAthletes,
    applicantsThisMonth,
    accepted,
    pipelineCount,
    activeGroups: groups.filter((g) => g.active).length,
    coaches: coaches.length,
    occupancyPct,
    improving,
    totalActive: enrollments.length,
    finance,
    missingDocs: docs.missing.length,
    expiredDocs: docs.expired.length,
    totalBudget,
    usedBudget,
    budgetPctUsed,
    groupDistribution,
    recentActivity,
    alerts,
    enrollments,
  };
}

// ── Coach Intelligence: roster-level summary for the Coach dashboard ──────
// Aggregates everything the coach needs to see at a glance about their own
// athletes' adaptive AI profiles + recent notes. Pure-ish on top of Prisma —
// shape is tailored for the My Dashboard surface (no Coach role guard here;
// callers pass the coachId they want to scope to, or null for academy-wide).
export type CoachIntelligenceSummary = {
  totalNotes: number;
  // Athletes the coach should look at first — sorted: injury flags > weaknesses > priorities.
  watchlist: {
    enrollmentId: string;
    athleteId: string;
    firstName: string;
    lastName: string;
    photoColor: string;
    injuryFlags: string[];     // capped at 3 for the card
    topWeakness: string | null;
    topPriority: string | null;
  }[];
  // Most recent coach notes across the coach's roster — links back to the
  // athlete's enrollment page.
  recentNotes: {
    id: string;
    enrollmentId: string;
    athleteName: string;
    athleteFirstName: string;
    athleteLastName: string;
    athletePhotoColor: string;
    createdAt: Date;
    rawText: string;
    kind: string | null;
    engine: string | null;
    sport: string;
    themes: string[];          // from aiSummary.themes (or [] if not structured)
  }[];
  // The coach's lens — aggregated theme frequency across roster aiProfiles.
  // Top entries advertise where the coach has been spending their attention.
  themeBalance: { theme: string; count: number }[];
};

export async function getCoachIntelligenceSummary(coachId: string | null): Promise<CoachIntelligenceSummary> {
  const academyId = await requireAcademyId();

  // Resolve the roster the coach actually works with: enrollments coached by
  // them OR whose group they coach. Admin scope (coachId === null) → entire
  // academy.
  const rosterEnrollments = await prisma.enrollment.findMany({
    where: {
      academyId,
      ...(coachId
        ? { OR: [{ coachId }, { group: { coachId } }] }
        : {}),
    },
    select: {
      id: true,
      athleteId: true,
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoColor: true,
          aiProfile: true,
        },
      },
    },
  });

  // Dedup by athleteId — an athlete with multiple enrollments still appears
  // once in the watchlist, keyed to the most recent enrollment we saw.
  const athleteToEnrollment = new Map<string, { enrollmentId: string }>();
  for (const e of rosterEnrollments) {
    if (!athleteToEnrollment.has(e.athleteId)) athleteToEnrollment.set(e.athleteId, { enrollmentId: e.id });
  }
  const athleteIds = [...athleteToEnrollment.keys()];

  // Build the watchlist from aiProfile data already on each athlete row.
  const watchlist: CoachIntelligenceSummary["watchlist"] = [];
  const themeAccumulator = new Map<string, number>();

  for (const e of rosterEnrollments) {
    // Only add once per athlete (the first row we saw wins).
    if (athleteToEnrollment.get(e.athleteId)?.enrollmentId !== e.id) continue;

    type AiProfile = {
      themeFrequency?: Record<string, number>;
      injuryFlags?: { text: string }[];
      recurringWeaknesses?: { text: string }[];
      priorities?: { text: string }[];
    };
    const ai = (e.athlete.aiProfile as unknown as AiProfile | null) ?? null;
    if (!ai) continue;

    // Roll theme counters into the academy-wide balance.
    for (const [theme, count] of Object.entries(ai.themeFrequency ?? {})) {
      themeAccumulator.set(theme, (themeAccumulator.get(theme) ?? 0) + count);
    }

    const injuryFlags = (ai.injuryFlags ?? []).slice(0, 3).map((f) => f.text);
    const topWeakness = ai.recurringWeaknesses?.[0]?.text ?? null;
    const topPriority = ai.priorities?.[0]?.text ?? null;

    // Only surface athletes that actually have something worth flagging.
    if (injuryFlags.length === 0 && !topWeakness && !topPriority) continue;
    watchlist.push({
      enrollmentId: e.id,
      athleteId: e.athlete.id,
      firstName: e.athlete.firstName,
      lastName: e.athlete.lastName,
      photoColor: e.athlete.photoColor,
      injuryFlags,
      topWeakness,
      topPriority,
    });
  }
  // Sort: injury flags first, then weaknesses, then priorities — most urgent first.
  watchlist.sort((a, b) => {
    const sev = (w: typeof a) => (w.injuryFlags.length > 0 ? 3 : 0) + (w.topWeakness ? 2 : 0) + (w.topPriority ? 1 : 0);
    return sev(b) - sev(a);
  });

  // Recent notes across the roster. Limit to athletes the coach actually
  // covers (athleteIds) — important even in admin scope so the query doesn't
  // pull every note in the academy when there are thousands.
  const recentRaw = athleteIds.length === 0
    ? []
    : await prisma.coachNote.findMany({
        where: { academyId, athleteId: { in: athleteIds } },
        select: {
          id: true,
          athleteId: true,
          rawText: true,
          kind: true,
          engine: true,
          sport: true,
          aiSummary: true,
          createdAt: true,
          athlete: { select: { firstName: true, lastName: true, photoColor: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      });

  const recentNotes: CoachIntelligenceSummary["recentNotes"] = recentRaw.map((n) => {
    const summary = (n.aiSummary as unknown as { themes?: string[] } | null) ?? null;
    const enrollment = athleteToEnrollment.get(n.athleteId)?.enrollmentId ?? "";
    return {
      id: n.id,
      enrollmentId: enrollment,
      athleteName: `${n.athlete.firstName} ${n.athlete.lastName}`,
      athleteFirstName: n.athlete.firstName,
      athleteLastName: n.athlete.lastName,
      athletePhotoColor: n.athlete.photoColor,
      createdAt: n.createdAt,
      rawText: n.rawText,
      kind: n.kind,
      engine: n.engine,
      sport: n.sport,
      themes: Array.isArray(summary?.themes) ? summary!.themes.slice(0, 4) : [],
    };
  });

  const totalNotes = athleteIds.length === 0
    ? 0
    : await prisma.coachNote.count({ where: { academyId, athleteId: { in: athleteIds } } });

  const themeBalance = [...themeAccumulator.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return { totalNotes, watchlist, recentNotes, themeBalance };
}

// ── Sport-specific dashboard stats ────────────────────────────────────────
// Computed separately from getDashboard so the universal flow stays sport-
// agnostic. Callers (the overview page) only hit this when the active sport
// module actually wants the values (tennis = matchesThisSeason / avgWinRate).
export type TennisDashboardStats = {
  matchesThisSeason: number;
  avgWinRate: number;     // 0-100
};

export async function getTennisDashboardStats(opts: SeasonScope = {}): Promise<TennisDashboardStats> {
  const academyId = await requireAcademyId();
  const bounds = opts.season ? seasonBounds(opts.season) : null;
  const matches = await prisma.tennisMatch.findMany({
    where: {
      academyId,
      ...(bounds ? { date: { gte: bounds.start, lte: bounds.end } } : {}),
    },
    select: { result: true },
  });
  const total = matches.length;
  const wins = matches.filter((m) => m.result === "won").length;
  return {
    matchesThisSeason: total,
    avgWinRate: total > 0 ? Math.round((wins / total) * 100) : 0,
  };
}

// ── Reports: season-aware aggregations ─────────────────────────────────────
// One season-of-data, computed from base tables filtered by season bounds.
// Pure-ish on top of Prisma — same shape regardless of season, so the caller
// can do side-by-side comparison + trend strips without special-casing.
export type SeasonReport = {
  season: string;
  currency: string;
  // counts
  newAthletes: number;            // enrollments joined in the season window
  newApplications: number;        // applications submitted in the season window
  acceptedApplications: number;
  rejectedApplications: number;
  // finance (base currency only)
  revenueCollected: number;       // sum(paidAmount) for payments paid in window
  revenueDue: number;             // sum(amount) for payments with dueDate in window
  expensesApproved: number;       // sum(amount) for approved/reimbursed expenses in window
  netResult: number;              // collected - approved expenses
  collectionRate: number;         // collected / due (0-100, 0 if no dues)
  // retention
  retainedFromPrior: number;      // athletes enrolled in BOTH this season and the prior one
  priorSeasonAthletes: number;    // base population for retention
  retentionRate: number;          // 0-100
  // mix
  packageMix: { id: string; name: string; count: number }[]; // top packages by enrollments joined in window
};

export async function getSeasonReport(season: string): Promise<SeasonReport> {
  const academyId = await requireAcademyId();
  const bounds = seasonBounds(season);
  const priorBounds = seasonBounds(previousSeason(season));

  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } });
  const baseCurrency = academy?.currency ?? "EUR";

  const [enrollments, priorEnrollments, applications, payments, expenses] = await Promise.all([
    prisma.enrollment.findMany({
      where: { academyId, joinDate: { gte: bounds.start, lte: bounds.end } },
      select: { id: true, athleteId: true, packageId: true, package: { select: { id: true, name: true } } },
    }),
    prisma.enrollment.findMany({
      where: { academyId, joinDate: { gte: priorBounds.start, lte: priorBounds.end } },
      select: { athleteId: true },
    }),
    prisma.application.findMany({
      where: { academyId, submittedAt: { gte: bounds.start, lte: bounds.end } },
      select: { status: true },
    }),
    prisma.payment.findMany({
      where: {
        academyId,
        currency: baseCurrency,
        OR: [
          { dueDate: { gte: bounds.start, lte: bounds.end } },
          { paidDate: { gte: bounds.start, lte: bounds.end } },
        ],
      },
      select: { amount: true, paidAmount: true, dueDate: true, paidDate: true },
    }),
    prisma.expense.findMany({
      where: {
        academyId,
        currency: baseCurrency,
        status: { in: ["approved", "reimbursed"] },
        // expenseDate is optional — fall back to createdAt at the call site
      },
      select: { amount: true, expenseDate: true, createdAt: true },
    }),
  ]);

  const newAthletes = enrollments.length;
  const acceptedApplications = applications.filter((a) => a.status === "accepted").length;
  const rejectedApplications = applications.filter((a) => a.status === "rejected").length;

  const revenueDue = payments
    .filter((p) => p.dueDate >= bounds.start && p.dueDate <= bounds.end)
    .reduce((s, p) => s + p.amount, 0);
  const revenueCollected = payments
    .filter((p) => p.paidDate && p.paidDate >= bounds.start && p.paidDate <= bounds.end)
    .reduce((s, p) => s + p.paidAmount, 0);
  const expensesApproved = expenses
    .filter((e) => {
      const d = e.expenseDate ?? e.createdAt;
      return d >= bounds.start && d <= bounds.end;
    })
    .reduce((s, e) => s + e.amount, 0);
  const netResult = revenueCollected - expensesApproved;
  const collectionRate = revenueDue > 0 ? Math.round((revenueCollected / revenueDue) * 100) : 0;

  // Retention: of the athletes enrolled last season, how many are still enrolled this season?
  const priorAthletes = new Set(priorEnrollments.map((e) => e.athleteId));
  const currentAthletes = new Set(enrollments.map((e) => e.athleteId));
  let retained = 0;
  priorAthletes.forEach((id) => { if (currentAthletes.has(id)) retained++; });
  const retentionRate = priorAthletes.size > 0 ? Math.round((retained / priorAthletes.size) * 100) : 0;

  // Package mix (top 5 by new enrollments joined in the window).
  const pkgCounts = new Map<string, { id: string; name: string; count: number }>();
  for (const e of enrollments) {
    if (!e.package) continue;
    const cur = pkgCounts.get(e.package.id);
    if (cur) cur.count++;
    else pkgCounts.set(e.package.id, { id: e.package.id, name: e.package.name, count: 1 });
  }
  const packageMix = Array.from(pkgCounts.values()).sort((a, b) => b.count - a.count).slice(0, 5);

  return {
    season,
    currency: baseCurrency,
    newAthletes,
    newApplications: applications.length,
    acceptedApplications,
    rejectedApplications,
    revenueCollected,
    revenueDue,
    expensesApproved,
    netResult,
    collectionRate,
    retainedFromPrior: retained,
    priorSeasonAthletes: priorAthletes.size,
    retentionRate,
    packageMix,
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

  const order = { high: 0, medium: 1, low: 2 };
  return alerts.sort((x, y) => order[x.severity] - order[y.severity]);
}

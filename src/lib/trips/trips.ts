import { prisma } from "@/lib/db";
import { computeBalances, type ExpenseCategory, type TripDetail, type TripSummary, type TripMemberView, type TripExpenseView } from "./tripTypes";

// Server read layer for Trasferte.

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

export async function getTrips(academyId: string): Promise<TripSummary[]> {
  const rows = await safe(
    () => prisma.trip.findMany({
      where: { academyId },
      orderBy: { startDate: "desc" },
      include: { members: { select: { id: true } }, expenses: { select: { amount: true } } },
    }),
    [] as { id: string; name: string; location: string | null; zone: string | null; startDate: Date; endDate: Date | null; members: { id: string }[]; expenses: { amount: number }[] }[],
  );
  return rows.map((t) => {
    const total = t.expenses.reduce((s, e) => s + e.amount, 0);
    const n = t.members.length;
    return {
      id: t.id, name: t.name, location: t.location, zone: t.zone,
      startDate: t.startDate.toISOString(), endDate: t.endDate?.toISOString() ?? null,
      memberCount: n, total, perHead: n > 0 ? Math.round(total / n) : 0, currency: "EUR",
    };
  });
}

export async function getTripDetail(academyId: string, tripId: string): Promise<TripDetail | null> {
  const t = await safe(
    () => prisma.trip.findFirst({
      where: { id: tripId, academyId },
      include: {
        members: { orderBy: { createdAt: "asc" } },
        expenses: { orderBy: { createdAt: "asc" } },
      },
    }),
    null,
  );
  if (!t) return null;

  const members: TripMemberView[] = t.members.map((m) => ({
    id: m.id, athleteId: m.athleteId, name: m.name, role: m.role as "player" | "coach", external: m.external,
  }));
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const expenses: TripExpenseView[] = t.expenses.map((e) => ({
    id: e.id, label: e.label, category: (e.category as ExpenseCategory) ?? "misc",
    amount: e.amount, currency: e.currency, date: e.date?.toISOString() ?? null,
    paidById: e.paidById, paidByName: e.paidById ? (nameById.get(e.paidById) ?? null) : null,
  }));

  const { total, perHead, balances } = computeBalances(members, expenses);
  return {
    id: t.id, name: t.name, location: t.location, zone: t.zone,
    startDate: t.startDate.toISOString(), endDate: t.endDate?.toISOString() ?? null,
    notes: t.notes, currency: "EUR", members, expenses, total, perHead, balances,
  };
}

// Roster athletes (ski ∪ tennis) for the "add member from the roster" picker.
export async function getRosterOptions(academyId: string): Promise<{ id: string; name: string }[]> {
  const [enr, plans] = await Promise.all([
    prisma.enrollment.findMany({ where: { academyId }, select: { athlete: { select: { id: true, firstName: true, lastName: true } } } }),
    prisma.tennisSeasonPlan.findMany({ where: { academyId }, select: { athlete: { select: { id: true, firstName: true, lastName: true } } } }),
  ]);
  const byId = new Map<string, string>();
  for (const e of enr) byId.set(e.athlete.id, `${e.athlete.firstName} ${e.athlete.lastName}`.trim());
  for (const p of plans) if (!byId.has(p.athlete.id)) byId.set(p.athlete.id, `${p.athlete.firstName} ${p.athlete.lastName}`.trim());
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

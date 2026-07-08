// Client-safe types + labels + split maths for the Trasferte module. No prisma.

export type ExpenseCategory = "travel" | "hotel" | "meals" | "entry" | "misc";

export const EXPENSE_CAT_META: Record<ExpenseCategory, { label: string; emoji: string }> = {
  travel: { label: "Trasporto", emoji: "🚐" },
  hotel: { label: "Alloggio", emoji: "🏨" },
  meals: { label: "Pasti", emoji: "🍝" },
  entry: { label: "Iscrizioni", emoji: "🎾" },
  misc: { label: "Varie", emoji: "🧾" },
};
export const EXPENSE_CAT_ORDER: ExpenseCategory[] = ["travel", "hotel", "meals", "entry", "misc"];

export type TripMemberView = {
  id: string;
  athleteId: string | null;
  name: string;
  role: "player" | "coach";
  external: boolean;
};

export type TripExpenseView = {
  id: string;
  label: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date: string | null;
  paidById: string | null;
  paidByName: string | null;
};

export type MemberBalance = {
  id: string;
  name: string;
  external: boolean;
  role: "player" | "coach";
  paid: number;    // total this member fronted
  share: number;   // their equal share of the total
  balance: number; // paid − share  (>0 = is owed, <0 = owes)
};

export type TripSummary = {
  id: string;
  name: string;
  location: string | null;
  zone: string | null;
  startDate: string;
  endDate: string | null;
  memberCount: number;
  total: number;
  perHead: number;
  currency: string;
};

export type TripDetail = {
  id: string;
  name: string;
  location: string | null;
  zone: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  currency: string;
  members: TripMemberView[];
  expenses: TripExpenseView[];
  total: number;
  perHead: number;
  balances: MemberBalance[];
};

// Equal split: every member owes total/memberCount; balance = what they paid
// minus that share. Drives the "chi deve / chi è a credito" settlement.
export function computeBalances(members: TripMemberView[], expenses: TripExpenseView[]): { total: number; perHead: number; balances: MemberBalance[] } {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const n = members.length;
  const perHead = n > 0 ? Math.round(total / n) : 0;
  const paidBy = new Map<string, number>();
  for (const e of expenses) if (e.paidById) paidBy.set(e.paidById, (paidBy.get(e.paidById) ?? 0) + e.amount);
  const balances: MemberBalance[] = members.map((m) => {
    const paid = paidBy.get(m.id) ?? 0;
    return { id: m.id, name: m.name, external: m.external, role: m.role, paid, share: perHead, balance: paid - perHead };
  });
  // Show who's owed the most first, then who owes the most.
  balances.sort((a, b) => b.balance - a.balance);
  return { total, perHead, balances };
}

export function tripDateLabel(startISO: string, endISO: string | null): string {
  const s = new Date(startISO);
  const fmt = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  if (!endISO) return `${fmt(s)} ${s.getFullYear()}`;
  const e = new Date(endISO);
  return `${fmt(s)} – ${fmt(e)} ${e.getFullYear()}`;
}

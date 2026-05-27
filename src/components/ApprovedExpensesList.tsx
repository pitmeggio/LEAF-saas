"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExpense } from "@/app/expense-actions";
import { fmtMoney } from "@/lib/domain";

// Itemised list of approved expenses for a group, with an inline delete
// affordance per row. Goes below the cost-line aggregate so the admin
// reads "Coaching = 300k" → "↳ Assistant coach Jan 2026 · 30k · ↳ …".
//
// Foreign-currency expenses (different from academy base currency) are
// included with their own currency suffix so they read as separate items
// rather than mixing into the base-currency totals.

type Expense = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  status: string;
  expenseDate: Date | null;
  notes: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  coaching: "Coaching",
  housing: "Housing",
  accommodation: "Accommodation",
  hotel: "Hotel",
  travel: "Travel",
  transport: "Transport",
  lift_pass: "Lift pass",
  fuel: "Fuel",
  equipment: "Equipment",
  race_cost: "Race cost",
  sport_ops: "Sport ops",
  other: "Other",
};

export function ApprovedExpensesList({
  expenses,
  currency,
  canDelete,
}: {
  expenses: Expense[];
  currency: string;
  canDelete: boolean;
}) {
  if (expenses.length === 0) return null;

  return (
    <div className="mt-3 border-t border-[var(--color-border)] pt-3">
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        Approved expenses ({expenses.length})
      </div>
      <ul className="space-y-1">
        {expenses.map((e) => (
          <ExpenseRow key={e.id} expense={e} currency={currency} canDelete={canDelete} />
        ))}
      </ul>
    </div>
  );
}

function ExpenseRow({
  expense,
  currency,
  canDelete,
}: {
  expense: Expense;
  currency: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onDelete = () => {
    setErr(null);
    start(async () => {
      const r = await deleteExpense(expense.id);
      if (r.ok) {
        router.refresh();
      } else {
        setErr(r.error ?? "Failed to delete.");
        setConfirming(false);
      }
    });
  };

  const dateLabel = expense.expenseDate
    ? new Date(expense.expenseDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : null;
  const categoryLabel = CATEGORY_LABEL[expense.category] ?? expense.category.replace(/_/g, " ");
  const amountStr = expense.currency === currency
    ? fmtMoney(expense.amount, currency)
    : `${expense.currency} ${expense.amount.toLocaleString()}`;

  return (
    <li className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-[var(--color-surface-2)]">
      <span className="mt-0.5 shrink-0 text-[var(--color-muted)]">↳</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{expense.title}</span>
          <span className="num shrink-0">{amountStr}</span>
        </div>
        <div className="truncate text-[10px] text-[var(--color-muted)]">
          {categoryLabel}{dateLabel ? ` · ${dateLabel}` : ""}{expense.notes ? ` · ${expense.notes}` : ""}
        </div>
        {err && <div className="mt-0.5 text-[10px] text-[#f87171]">{err}</div>}
      </div>
      {canDelete && (
        confirming ? (
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="rounded-md bg-[#f8717118] px-2 py-0.5 text-[10px] font-medium text-[#f87171] disabled:opacity-50"
            >
              {pending ? "…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              ×
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Delete expense ${expense.title}`}
            onClick={() => setConfirming(true)}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] hover:bg-[#f8717118] hover:text-[#f87171]"
          >
            ×
          </button>
        )
      )}
    </li>
  );
}

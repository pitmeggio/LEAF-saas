import Link from "next/link";

// Sub-navigation strip rendered at the top of every Finance surface so they
// read as one module. Sidebar shows a single "Finance" entry → /dashboard/finance;
// from there the user moves between the sub-areas via this nav.
//
// Revenue + Invoices live inside Payments (sections of the same page);
// Approvals lives inside Expenses. Tooltips spell that out so the nav stays
// short while the hub copy advertises the full surface.
export type FinanceSubNavKey = "overview" | "payments" | "budgets" | "expenses" | "packages";

const ITEMS: { key: FinanceSubNavKey; label: string; href: string; hint: string }[] = [
  { key: "overview", label: "Overview", href: "/dashboard/finance", hint: "Season finance at a glance" },
  { key: "payments", label: "Payments", href: "/dashboard/payments", hint: "Invoices, revenue, collections, overdue" },
  { key: "budgets", label: "Budgets", href: "/dashboard/budgets", hint: "Per-team budget, spend by cost line, P&L" },
  { key: "expenses", label: "Expenses", href: "/dashboard/expenses", hint: "Coach expenses + approvals queue" },
  { key: "packages", label: "Packages", href: "/dashboard/packages", hint: "Product catalogue (subscription pricing)" },
];

export function FinanceSubNav({ active }: { active: FinanceSubNavKey }) {
  return (
    <div className="border-b border-[var(--color-border)] px-8">
      <div className="-mb-px flex flex-wrap gap-1" role="tablist" aria-label="Finance sections">
        {ITEMS.map((it) => {
          const isActive = it.key === active;
          return (
            <Link
              key={it.key}
              href={it.href}
              role="tab"
              aria-selected={isActive}
              title={it.hint}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-[var(--color-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {it.label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-0 h-[2px] rounded-full"
                  style={{ background: "var(--color-accent)" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

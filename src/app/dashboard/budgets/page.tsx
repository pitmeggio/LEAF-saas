import { PageHeader } from "@/components/PageHeader";
import { PercentBar, StatCard } from "@/components/StatCard";
import { Modal, GroupExpenseForm } from "@/components/EntityForms";
import { getGroupsWithStats, getAcademyCurrency } from "@/lib/ops";
import { requireAdmin } from "@/lib/auth";
import { fmtMoney } from "@/lib/domain";

export const dynamic = "force-dynamic";

// FINANCE — Budgets per group/team. Admin-only deep view: per-group P&L
// (income vs actual costs), spend broken down by cost line, and a direct
// "+ Add expense" against any group budget. Cross-group totals at the top.
export default async function BudgetsPage() {
  await requireAdmin();
  const [groups, currency] = await Promise.all([getGroupsWithStats(), getAcademyCurrency()]);

  const totals = groups.reduce(
    (acc, g) => {
      acc.budget += g.budget ?? 0;
      acc.used += g.usedBudget;
      acc.pending += g.pendingExpenses;
      acc.burn += g.monthlyBurnRate;
      acc.income += g.revenue;
      acc.coachCost += g.coachCost;
      return acc;
    },
    { budget: 0, used: 0, pending: 0, burn: 0, income: 0, coachCost: 0 },
  );
  const totalCosts = totals.coachCost + totals.used;
  const totalResult = totals.income - totalCosts;
  const totalPctUsed = totals.budget > 0 ? Math.round((totals.used / totals.budget) * 100) : 0;

  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex justify-between"><dt className="text-[var(--color-muted)]">{label}</dt><dd className="num" style={color ? { color } : undefined}>{value}</dd></div>
  );

  return (
    <>
      <PageHeader title="Budgets" subtitle="Per-team budget, spend by cost line and P&L. Add expenses straight against a group budget." />

      <div className="space-y-6 p-8">
        {/* Academy-wide totals */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total budget" value={fmtMoney(totals.budget, currency)} hint="allocated across groups" />
          <StatCard label="Used" value={fmtMoney(totals.used, currency)} hint={`${totalPctUsed}% of budget`} danger={totalPctUsed > 100} />
          <StatCard label="Pending" value={fmtMoney(totals.pending, currency)} hint="awaiting approval" />
          <StatCard label="Monthly burn" value={fmtMoney(totals.burn, currency)} hint="last 30 days" />
          <StatCard label="Income (contracts)" value={fmtMoney(totals.income, currency)} accent hint="all active deals" />
          <StatCard label="Result" value={fmtMoney(totalResult, currency)} hint="income − costs" danger={totalResult < 0} />
        </div>

        {/* Per-group cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.length === 0 && <p className="text-sm text-[var(--color-muted)]">No groups yet.</p>}
          {groups.map((g) => {
            const costs = g.coachCost + g.usedBudget;
            const result = g.revenue - costs;
            return (
              <div key={g.id} className="card p-5" style={g.overBudget ? { borderColor: "#f87171" } : undefined}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-base font-semibold">{g.name}</div>
                    <div className="text-xs text-[var(--color-muted)]">{g.coach?.name ?? "No coach"} · Season {g.season}</div>
                  </div>
                  {g.overBudget && <span className="rounded-md bg-[#f8717120] px-2 py-0.5 text-[10px] font-semibold text-[#f87171]">OVER BUDGET</span>}
                </div>

                {g.budget != null && g.budget > 0 ? (
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-[var(--color-muted)]">Budget used</span>
                      <span className="num">{g.pctUsed}%{g.budgetHardStop ? " · hard stop" : ""}</span>
                    </div>
                    <PercentBar value={Math.min(100, g.pctUsed)} color={g.overBudget ? "#f87171" : g.pctUsed > 85 ? "#f59e0b" : "var(--color-accent)"} />
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">No budget set — edit the group to allocate one.</div>
                )}

                <dl className="mt-4 space-y-1.5 border-t border-[var(--color-border)] pt-3 text-sm">
                  <Row label="Budget allocation" value={fmtMoney(g.budget, currency)} />
                  <Row label="Used" value={fmtMoney(g.usedBudget, currency)} />
                  <Row label="Remaining" value={fmtMoney(g.remainingBudget, currency)} color={g.remainingBudget < 0 ? "#f87171" : undefined} />
                  <Row label="Pending expenses" value={fmtMoney(g.pendingExpenses, currency)} />
                  <Row label="Monthly burn" value={fmtMoney(g.monthlyBurnRate, currency)} />
                  {g.foreignExpenseCount > 0 && (
                    <div className="pt-0.5 text-[10px] text-[var(--color-muted)]">+{g.foreignExpenseCount} foreign-currency expense(s) tracked separately</div>
                  )}
                </dl>

                {g.categoryBreakdown.length > 0 && (
                  <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                    <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Spend by cost line</div>
                    <dl className="space-y-1 text-xs">
                      {g.categoryBreakdown.map((c) => (
                        <div key={c.category} className="flex justify-between">
                          <dt className="capitalize text-[var(--color-muted)]">{c.category.replace(/_/g, " ")}</dt>
                          <dd className="num">{fmtMoney(c.amount, currency)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                <div className="mt-3 border-t border-[var(--color-border)] pt-3 text-sm">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Team P&amp;L</div>
                  <Row label="Income (contracts)" value={fmtMoney(g.revenue, currency)} />
                  <Row label="Costs (coach + spend)" value={fmtMoney(costs, currency)} />
                  <div className="mt-1 flex justify-between border-t border-[var(--color-border)] pt-1.5">
                    <dt className="font-medium">Result</dt>
                    <dd className="num font-semibold" style={{ color: result >= 0 ? "var(--color-accent)" : "#f87171" }}>{fmtMoney(result, currency)}</dd>
                  </div>
                </div>

                <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                  <Modal label="+ Add expense" title={`Add to ${g.name} budget`} className="rounded-lg border border-[#7CFF6B40] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[#7cff6b12]">
                    <GroupExpenseForm groupId={g.id} currency={currency} />
                  </Modal>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

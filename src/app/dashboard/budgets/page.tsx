import { PageHeader } from "@/components/PageHeader";
import { PercentBar, StatCard } from "@/components/StatCard";
import { Modal, GroupExpenseForm } from "@/components/EntityForms";
import { FinanceSubNav } from "@/components/FinanceSubNav";
import { RevenueLedger } from "@/components/RevenueLedger";
import { ApprovedExpensesList } from "@/components/ApprovedExpensesList";
import { BudgetForecastTotals, BudgetForecastCard } from "@/components/BudgetForecast";
import { BudgetBenchmarksForm } from "@/components/BudgetBenchmarksForm";
import { getGroupsWithStats, getAcademyCurrency, getBudgetForecastForAcademy, getBudgetBenchmarks } from "@/lib/ops";
import { requireAdmin } from "@/lib/auth";
import { fmtMoney } from "@/lib/domain";
import { getActiveSeason } from "@/lib/season-server";

export const dynamic = "force-dynamic";

// FINANCE — Budgets per group/team. Admin-only deep view: per-group P&L
// (income vs actual costs), spend broken down by cost line, and a direct
// "+ Add expense" against any group budget. Cross-group totals at the top.
export default async function BudgetsPage() {
  await requireAdmin();
  const season = await getActiveSeason();
  const [groups, currency, forecast, benchmarks] = await Promise.all([
    getGroupsWithStats(null, { season }),
    getAcademyCurrency(),
    getBudgetForecastForAcademy({ season }),
    getBudgetBenchmarks(),
  ]);
  const forecastById = new Map(forecast.forecasts.map((f) => [f.groupId, f]));

  const totals = groups.reduce(
    (acc, g) => {
      acc.budget += g.budget ?? 0;
      acc.used += g.usedBudget;
      acc.committed += g.committedSpend;
      acc.pending += g.pendingExpenses;
      acc.burn += g.monthlyBurnRate;
      acc.athleteIncome += g.collectedRevenue;
      acc.otherIncome += g.receivedRevenue;
      acc.pledged += g.pledgedRevenue;
      acc.coachCost += g.coachCost;
      acc.packageRevenue += g.revenue;
      return acc;
    },
    { budget: 0, used: 0, committed: 0, pending: 0, burn: 0, athleteIncome: 0, otherIncome: 0, pledged: 0, coachCost: 0, packageRevenue: 0 },
  );
  const totalIncome = totals.athleteIncome + totals.otherIncome;
  const totalCosts = totals.coachCost + totals.used;
  const totalResult = totalIncome - totalCosts;
  const totalPctUsed = totals.budget > 0 ? Math.round((totals.committed / totals.budget) * 100) : 0;

  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex justify-between"><dt className="text-[var(--color-muted)]">{label}</dt><dd className="num" style={color ? { color } : undefined}>{value}</dd></div>
  );

  return (
    <>
      <PageHeader
        title="Budgets"
        subtitle={`Season ${season} · each team's budget derives automatically from the athlete packages enrolled, then tracks spend against it.`}
      />
      <FinanceSubNav active="budgets" />

      <div className="space-y-6 p-8">
        {/* Academy-wide totals — 4 cards (was 6) to make the headline read
            instantly: how much room do we have, how much is committed,
            how much income is actually in the bank, where do we land. */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Team budgets"
            value={fmtMoney(totals.budget, currency)}
            hint="auto from athlete packages"
          />
          <StatCard
            label="Spent + committed"
            value={fmtMoney(totals.committed, currency)}
            hint={`${totalPctUsed}% of budget${totals.pending > 0 ? ` · +${fmtMoney(totals.pending, currency)} pending` : ""}`}
            danger={totalPctUsed > 100}
          />
          <StatCard
            label="Income received"
            value={fmtMoney(totalIncome, currency)}
            accent
            hint={`${fmtMoney(totals.athleteIncome, currency)} athletes${totals.otherIncome > 0 ? ` · ${fmtMoney(totals.otherIncome, currency)} other` : ""}${totals.pledged > 0 ? ` · +${fmtMoney(totals.pledged, currency)} pledged` : ""}`}
          />
          <StatCard
            label="Net (real)"
            value={fmtMoney(totalResult, currency)}
            hint="income received − costs paid"
            danger={totalResult < 0}
          />
        </div>

        {/* AI forecast — what the season is projected to cost vs bring in,
            derived from the roster + season calendar + cost benchmarks. */}
        <BudgetForecastTotals
          totalCost={forecast.rollup.totalCost}
          totalIncome={forecast.rollup.totalIncome}
          totalNet={forecast.rollup.totalNet}
          totalAthletes={forecast.rollup.totalAthletes}
          groupCount={forecast.rollup.groupCount}
          currency={forecast.currency}
          configured={forecast.benchmarksConfigured}
        />

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

                {g.budget > 0 ? (
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-[var(--color-muted)]">Spent vs budget</span>
                      <span className="num">{g.pctUsed}%{g.budgetHardStop ? " · hard stop" : ""}</span>
                    </div>
                    <PercentBar value={Math.min(100, g.pctUsed)} color={g.overBudget ? "#f87171" : g.pctUsed > 85 ? "#f59e0b" : "var(--color-accent)"} />
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
                    No athletes enrolled — assign athletes or set a manual budget on the group.
                  </div>
                )}

                <dl className="mt-4 space-y-1.5 border-t border-[var(--color-border)] pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-muted)]">
                      Team budget
                      {g.budgetAutoDerived && (
                        <span className="ml-1.5 rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--color-muted)]">
                          auto · {g.count} ath × pkg
                        </span>
                      )}
                    </dt>
                    <dd className="num">{fmtMoney(g.budget, currency)}</dd>
                  </div>
                  <Row label="Coach salary (committed)" value={fmtMoney(g.coachCost, currency)} />
                  <Row label="Expenses approved" value={fmtMoney(g.usedBudget, currency)} />
                  <Row label="Total spent / committed" value={fmtMoney(g.committedSpend, currency)} color={g.overBudget ? "#f87171" : undefined} />
                  <Row label="Remaining" value={fmtMoney(g.remainingBudget, currency)} color={g.remainingBudget < 0 ? "#f87171" : undefined} />
                  {g.pendingExpenses > 0 && <Row label="Pending expenses" value={fmtMoney(g.pendingExpenses, currency)} />}
                  {g.monthlyBurnRate > 0 && <Row label="Monthly burn" value={fmtMoney(g.monthlyBurnRate, currency)} />}
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

                {/* Itemised approved expenses — admin sees each entry and can
                    remove a wrongly-added one without leaving the page. */}
                <ApprovedExpensesList
                  expenses={g.expenses
                    .filter((e) => e.status === "approved" || e.status === "reimbursed")
                    .map((e) => ({
                      id: e.id,
                      title: e.title,
                      amount: e.amount,
                      currency: e.currency,
                      category: e.category,
                      status: e.status,
                      expenseDate: e.expenseDate,
                      notes: e.notes,
                    }))}
                  currency={currency}
                  canDelete
                />

                {/* Income ledger — sponsor, federation, academy allocation,
                    misc. Wired per-group; admin can also add academy-wide
                    income (groupId null) from a future hub. */}
                <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                  <RevenueLedger
                    groupId={g.id}
                    currency={currency}
                    rows={g.revenues.map((r) => ({
                      id: r.id,
                      title: r.title,
                      amount: r.amount,
                      currency: r.currency,
                      category: r.category,
                      status: r.status,
                      source: r.source,
                      receivedDate: r.receivedDate,
                      notes: r.notes,
                    }))}
                    title="Income"
                  />
                </div>

                <div className="mt-3 border-t border-[var(--color-border)] pt-3 text-sm">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Team P&amp;L (real)</div>
                  <Row label="Income — athletes (paid)" value={fmtMoney(g.collectedRevenue, currency)} />
                  <Row label="Income — other (received)" value={fmtMoney(g.receivedRevenue, currency)} />
                  {g.pledgedRevenue > 0 && (
                    <Row label="+ pledged (not yet received)" value={fmtMoney(g.pledgedRevenue, currency)} color="#f59e0b" />
                  )}
                  <Row label="Costs (coach + spend)" value={fmtMoney(costs, currency)} />
                  <div className="mt-1 flex justify-between border-t border-[var(--color-border)] pt-1.5">
                    <dt className="font-medium">Net result</dt>
                    <dd className="num font-semibold" style={{ color: g.netResult >= 0 ? "var(--color-accent)" : "#f87171" }}>{fmtMoney(g.netResult, currency)}</dd>
                  </div>
                </div>

                {forecast.benchmarksConfigured && forecastById.has(g.id) && (
                  <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                    <BudgetForecastCard forecast={forecastById.get(g.id)!} currency={forecast.currency} />
                  </div>
                )}

                <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                  <Modal label="+ Add expense" title={`Add to ${g.name} budget`} className="rounded-lg border border-[#7CFF6B40] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[#7cff6b12]">
                    <GroupExpenseForm groupId={g.id} currency={currency} />
                  </Modal>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cost benchmarks — set once per academy. The forecast engine
            multiplies these rates by quantities the engine derives from
            the roster, the season calendar and the coach roster. */}
        <div id="benchmarks" className="card p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Cost benchmarks</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Set your academy&apos;s rates once — the forecast above recomputes from your roster + season calendar every time you load this page.
            </p>
          </div>
          <BudgetBenchmarksForm initial={benchmarks} currency={currency} />
        </div>
      </div>
    </>
  );
}

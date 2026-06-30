import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, PercentBar } from "@/components/StatCard";
import { FinanceSubNav } from "@/components/FinanceSubNav";
import { getFinance, getGroupsWithStats, getExpenses, getPackagesWithStats } from "@/lib/ops";
import { requireAdmin } from "@/lib/auth";
import { fmtMoney } from "@/lib/domain";
import { getActiveSeason } from "@/lib/season-server";

export const dynamic = "force-dynamic";

// FINANCE — central hub. Single landing for every money surface in LEAF:
// season revenue, pending invoices, budget exposure, approvals queue and the
// product catalogue. Tiles bridge to the dedicated sub-pages (Payments,
// Budgets, Expenses, Packages); everything is scoped to the active season.
export default async function FinanceHubPage() {
  await requireAdmin();
  const season = await getActiveSeason();
  const [finance, groups, expenses, packages] = await Promise.all([
    getFinance({ season }),
    getGroupsWithStats(null, { season }),
    getExpenses(),
    getPackagesWithStats({ season }),
  ]);

  const totalBudget = groups.reduce((s, g) => s + (g.budget ?? 0), 0);
  const usedBudget = groups.reduce((s, g) => s + g.usedBudget, 0);
  const budgetPctUsed = totalBudget > 0 ? Math.round((usedBudget / totalBudget) * 100) : 0;
  const remainingBudget = Math.max(0, totalBudget - usedBudget);
  const activePackages = packages.filter((p) => p.activeCount > 0).length;

  return (
    <>
      <PageHeader
        title="Finanza"
        subtitle={`Stagione ${season} · ricavi, fatture, budget, spese, approvazioni e pacchetti — un solo modulo.`}
      />
      <FinanceSubNav active="overview" />

      <div className="space-y-6 p-8">
        {/* Headline KPIs — the whole season at a glance */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Season revenue"
            value={fmtMoney(finance.collected, finance.currency)}
            hint={`collected · ${season}`}
            accent
            href="/dashboard/payments"
          />
          <StatCard
            label="Outstanding"
            value={fmtMoney(finance.outstandingTotal, finance.currency)}
            hint={`billed, not yet paid`}
            danger={finance.outstandingTotal > 0}
            href="/dashboard/payments"
          />
          <StatCard
            label="Overdue"
            value={fmtMoney(finance.overdueTotal, finance.currency)}
            hint={`${finance.unpaidAthletes} athlete(s) to chase`}
            danger={finance.overdueTotal > 0}
            href="/dashboard/payments"
          />
          <StatCard
            label="Budget usage"
            value={`${budgetPctUsed}%`}
            hint={`${fmtMoney(usedBudget, finance.currency)} of ${fmtMoney(totalBudget, finance.currency)}`}
            danger={budgetPctUsed > 100}
            href="/dashboard/budgets"
          />
          <StatCard
            label="Pending approvals"
            value={String(expenses.pendingCount)}
            hint="coach expenses awaiting review"
            danger={expenses.pendingCount > 0}
            href="/dashboard/expenses"
          />
          <StatCard
            label="Active subscriptions"
            value={String(finance.activeSubscriptions)}
            hint={`across ${activePackages} active package(s)`}
            href="/dashboard/packages"
          />
        </div>

        {/* Subsection tiles — bridges to each finance area with a short snapshot */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Tile
            href="/dashboard/payments"
            title="Pagamenti"
            kicker="invoices · revenue · collections"
            summary={`${fmtMoney(finance.collected, finance.currency)} collected · ${fmtMoney(finance.outstandingTotal, finance.currency)} outstanding`}
          >
            <KV label="Invoices paid" value={String(finance.invoiceStates.paid ?? 0)} />
            <KV label="Invoices overdue" value={String(finance.invoiceStates.overdue ?? 0)} danger={Boolean(finance.invoiceStates.overdue)} />
            <KV label="Monthly recurring" value={fmtMoney(finance.monthlyRecurring, finance.currency)} muted />
          </Tile>

          <Tile
            href="/dashboard/budgets"
            title="Budgets"
            kicker="per-team allocation · spend · P&L"
            summary={`${budgetPctUsed}% used · ${fmtMoney(remainingBudget, finance.currency)} remaining`}
          >
            <PercentBar value={Math.min(100, budgetPctUsed)} color={budgetPctUsed > 100 ? "#f87171" : budgetPctUsed > 85 ? "#f59e0b" : "var(--color-accent)"} />
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--color-muted)]">
              <span>Teams: <span className="num text-[var(--color-fg)]">{groups.length}</span></span>
              <span>Over budget: <span className="num" style={{ color: groups.filter((g) => g.overBudget).length ? "#f87171" : undefined }}>{groups.filter((g) => g.overBudget).length}</span></span>
            </div>
          </Tile>

          <Tile
            href="/dashboard/expenses"
            title="Spese & Approvazioni"
            kicker="coach receipts · approval queue"
            summary={`${expenses.pendingCount} awaiting · ${fmtMoney(expenses.approvedTotal, finance.currency)} approved`}
          >
            <KV label="Submitted (pending)" value={fmtMoney(expenses.submittedTotal, finance.currency)} danger={expenses.pendingCount > 0} />
            <KV label="Reimbursed" value={fmtMoney(expenses.reimbursedTotal, finance.currency)} muted />
          </Tile>

          <Tile
            href="/dashboard/packages"
            title="Pacchetti"
            kicker="product catalogue · subscription pricing"
            summary={`${activePackages} active · ${packages.length} total`}
          >
            <KV label="Total contract value" value={fmtMoney(finance.totalContract, finance.currency)} />
            <KV label="Active subscriptions" value={String(finance.activeSubscriptions)} muted />
          </Tile>

          <Tile
            href="/dashboard/payments"
            title="Mix ricavi"
            kicker="which packages drive the money"
            summary={`${finance.packageBreakdown.length} package(s) producing revenue`}
          >
            {finance.packageBreakdown.slice(0, 3).map((p) => (
              <KV key={p.id} label={p.name} value={fmtMoney(p.revenue, p.currency)} muted />
            ))}
            {finance.packageBreakdown.length === 0 && (
              <p className="text-xs text-[var(--color-muted)]">No revenue recorded for this season yet.</p>
            )}
          </Tile>

          <Tile
            href="/dashboard/payments"
            title="Stato fatture"
            kicker="lifecycle counts across the season"
            summary={`${finance.invoiceStates.paid ?? 0} paid · ${finance.invoiceStates.overdue ?? 0} overdue`}
          >
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {Object.entries(finance.invoiceStates).map(([k, v]) => (
                <div key={k} className="flex justify-between capitalize text-[var(--color-muted)]"><span>{k}</span><span className="num text-[var(--color-fg)]">{v}</span></div>
              ))}
            </div>
          </Tile>

          {/* Reports lives inside Finance now — used to have its own sidebar
              entry, but the report content is finance-shaped (P&L, packages,
              outstanding) so it reads more honestly as a Finance tab. */}
          <Tile
            href="/dashboard/reports"
            title="Report"
            kicker="season P&L · roster · finance read-out"
            summary={`${finance.activeSubscriptions} active subscriptions · ${fmtMoney(finance.totalContract, finance.currency)} contract value`}
          >
            <KV label="Collected this season" value={fmtMoney(finance.collected, finance.currency)} />
            <KV label="Outstanding" value={fmtMoney(finance.outstandingTotal, finance.currency)} muted />
          </Tile>
        </div>
      </div>
    </>
  );
}

function Tile({
  href,
  title,
  kicker,
  summary,
  children,
}: {
  href: string;
  title: string;
  kicker: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="card group block p-5 transition-colors hover:border-[var(--color-accent)]"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-[10px] text-[var(--color-muted)] group-hover:text-[var(--color-accent)]">Open →</span>
      </div>
      <div className="mb-3 text-[11px] uppercase tracking-wide text-[var(--color-muted)]/80">{kicker}</div>
      <div className="mb-3 text-sm font-medium">{summary}</div>
      <div className="space-y-1.5 border-t border-[var(--color-border)] pt-3">{children}</div>
    </Link>
  );
}

function KV({ label, value, danger, muted }: { label: string; value: string; danger?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="num font-medium" style={danger ? { color: "#f87171" } : muted ? { color: "var(--color-muted)" } : undefined}>{value}</span>
    </div>
  );
}

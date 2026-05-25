import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, PercentBar, Dot } from "@/components/StatCard";
import { getAcademy } from "@/lib/queries";
import { getDashboard, getTennisDashboardStats } from "@/lib/ops";
import { getSession } from "@/lib/auth";
import { CoachDashboard } from "@/components/CoachDashboard";
import { fmtMoney } from "@/lib/domain";
import { getActiveSeason } from "@/lib/season-server";
import { getSportModuleForAcademy } from "@/lib/sports/registry";
import type { DashboardKpi } from "@/lib/sports/types";

export const dynamic = "force-dynamic";

const SEV_COLOR = { high: "#f87171", medium: "#f59e0b", low: "#8a93a6" } as const;

// Premium, focused Overview — 6 KPI cards + Today (AI) + Group distribution +
// Recent activity. Anything deeper lives in its own module (Finance, Reports…).
export default async function OverviewPage() {
  const session = await getSession();
  if (session && !session.isAdmin) return <CoachDashboard />;

  const season = await getActiveSeason();
  const [academy, d] = await Promise.all([getAcademy(), getDashboard({ season })]);
  const f = d.finance;
  const perfAlertCount = d.alerts.filter((a) => a.type === "declining_trend").length;

  // Sport-aware KPI grid — the active sport module decides what to display.
  // Only fetch sport-specific aggregates (tennis) when the module asks for them.
  const sport = getSportModuleForAcademy(academy);
  const needsTennisStats = sport.dashboardKpis.some((k) =>
    k.source === "matchesThisSeason" || k.source === "avgWinRate"
  );
  const tennisStats = needsTennisStats ? await getTennisDashboardStats({ season }) : null;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={`${academy?.name ?? ""}${academy?.location ? " · " + academy.location : ""} · Season ${season}`}
        right={
          <Link href="/dashboard/alerts" className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)]">
            {d.alerts.length} alert{d.alerts.length === 1 ? "" : "s"} →
          </Link>
        }
      />

      <div className="space-y-6 p-8">
        {/* Today — AI triage. Hidden when nothing needs you. */}
        {d.alerts.length > 0 ? (
          <div className="card p-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
              <h2 className="text-sm font-semibold">Today</h2>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              <span className="font-semibold text-[var(--color-fg)]">{d.alerts.length} thing{d.alerts.length === 1 ? "" : "s"} need you</span> — everything else is handled automatically across {d.activeAthletes} athletes.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {d.alerts.slice(0, 4).map((a) => (
                <Link key={a.id} href={a.href ?? "#"} className="group flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 hover:border-[var(--color-accent)]">
                  <Dot color={SEV_COLOR[a.severity]} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-[var(--color-muted)]">{a.detail}</span>
                  </span>
                  <span className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)]">→</span>
                </Link>
              ))}
            </div>
            {d.alerts.length > 4 && (
              <Link href="/dashboard/alerts" className="mt-3 inline-block text-xs text-[var(--color-accent)] hover:underline">See all {d.alerts.length} →</Link>
            )}
          </div>
        ) : (
          <div className="card flex items-center gap-3 p-4 text-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
            <span className="text-[var(--color-fg)]/85">✓ You&apos;re all caught up. LEAF is auto-tracking {d.activeAthletes} athletes.</span>
          </div>
        )}

        {/* Sport-aware KPI grid — the active sport module decides which cards
            land here. Ski leads with Performance alerts + Budget usage;
            Tennis swaps those out for Matches this season + Avg win rate. */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {sport.dashboardKpis.map((kpi) => {
            const props = kpiCardProps(kpi, {
              season,
              activeAthletes: d.activeAthletes,
              pipelineCount: d.pipelineCount,
              accepted: d.accepted,
              budgetPctUsed: d.budgetPctUsed,
              usedBudget: d.usedBudget,
              totalBudget: d.totalBudget,
              perfAlertCount,
              currency: f.currency,
              collected: f.collected,
              outstandingTotal: f.outstandingTotal,
              unpaidAthletes: f.unpaidAthletes,
              tennisStats,
            });
            return <StatCard key={kpi.key} {...props} />;
          })}
        </div>

        {/* Two-column: Group distribution + Recent activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Group distribution</h2>
              <Link href="/dashboard/groups" className="text-[11px] text-[var(--color-accent)] hover:underline">All groups →</Link>
            </div>
            {d.groupDistribution.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No groups yet.</p>
            ) : (
              <div className="space-y-3">
                {d.groupDistribution.map((g) => (
                  <div key={g.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{g.name}</span>
                      <span className="num text-[var(--color-muted)]">{g.count}/{g.capacity} · {g.pct}%</span>
                    </div>
                    <PercentBar value={g.pct} color={g.pct > 100 ? "#f87171" : g.pct > 85 ? "#f59e0b" : "var(--color-accent)"} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent activity</h2>
              <Link href="/dashboard/applications" className="text-[11px] text-[var(--color-accent)] hover:underline">All applications →</Link>
            </div>
            {d.recentActivity.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {d.recentActivity.map((a) => (
                  <Link key={a.id} href={a.href} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm hover:border-[var(--color-accent)]">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.title}</div>
                      <div className="truncate text-[11px] capitalize text-[var(--color-muted)]">{a.detail}</div>
                    </div>
                    <div className="shrink-0 text-[10px] text-[var(--color-muted)]">{new Date(a.when).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Maps a sport-module KPI (declared as a `source` key) to the props the
// StatCard component renders. New KPI sources land here — keep the switch
// exhaustive so new sports drop in without surprises.
type KpiData = {
  season: string;
  activeAthletes: number;
  pipelineCount: number;
  accepted: number;
  budgetPctUsed: number;
  usedBudget: number;
  totalBudget: number;
  perfAlertCount: number;
  currency: string;
  collected: number;
  outstandingTotal: number;
  unpaidAthletes: number;
  tennisStats: { matchesThisSeason: number; avgWinRate: number } | null;
};

function kpiCardProps(kpi: DashboardKpi, d: KpiData) {
  const base = { label: kpi.label, hint: kpi.hint } as { label: string; value: string; hint?: string; accent?: boolean; danger?: boolean; href?: string };
  switch (kpi.source) {
    case "totalAthletes":
      return { ...base, value: String(d.activeAthletes), hint: kpi.hint ?? "enrolled members", accent: true, href: "/dashboard/athletes" };
    case "activeApplications":
      return { ...base, value: String(d.pipelineCount), hint: kpi.hint ?? `${d.accepted} accepted this season`, href: "/dashboard/applications" };
    case "seasonRevenue":
      return { ...base, value: fmtMoney(d.collected, d.currency), hint: kpi.hint ?? `paid · ${d.season}`, accent: !kpi.hint, href: "/dashboard/payments" };
    case "pendingPayments":
      return { ...base, value: fmtMoney(d.outstandingTotal, d.currency), hint: kpi.hint ?? `${d.unpaidAthletes} athlete(s) to chase`, danger: d.outstandingTotal > 0, href: "/dashboard/payments" };
    case "budgetUsage":
      return { ...base, value: `${d.budgetPctUsed}%`, hint: kpi.hint ?? `${fmtMoney(d.usedBudget, d.currency)} of ${fmtMoney(d.totalBudget, d.currency)}`, danger: d.budgetPctUsed > 100, href: "/dashboard/budgets" };
    case "performanceAlerts":
      return { ...base, value: String(d.perfAlertCount), hint: kpi.hint ?? "athletes trending down", danger: d.perfAlertCount > 0, href: "/dashboard/alerts" };
    case "matchesThisSeason":
      return { ...base, value: String(d.tennisStats?.matchesThisSeason ?? 0), hint: kpi.hint ?? `recorded · ${d.season}`, href: "/dashboard/athletes" };
    case "avgWinRate":
      return { ...base, value: `${d.tennisStats?.avgWinRate ?? 0}%`, hint: kpi.hint ?? "across all logged matches", accent: (d.tennisStats?.avgWinRate ?? 0) >= 50, href: "/dashboard/athletes" };
    case "avgFisProgression":
      // Reserved for a future ski-specific aggregate; falls back gracefully.
      return { ...base, value: "—", hint: kpi.hint ?? "season progression (coming)" };
    default: {
      // Exhaustiveness guard — surfaced if a sport adds a new source the
      // page hasn't taught itself to render yet.
      const _exhaustive: never = kpi.source;
      return { ...base, value: "—" };
    }
  }
}

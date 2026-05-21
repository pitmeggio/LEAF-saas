import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, PercentBar, Dot } from "@/components/StatCard";
import { getAcademy } from "@/lib/queries";
import { getDashboard } from "@/lib/ops";
import { getInboxStats } from "@/lib/chat";
import { getSession } from "@/lib/auth";
import { CoachDashboard } from "@/components/CoachDashboard";
import { fmtMoney } from "@/lib/domain";
import { academyHealth } from "@/lib/ai/academyHealth";
import { AcademyHealthPanel } from "@/components/AcademyHealthPanel";

export const dynamic = "force-dynamic";

const SEV_COLOR = { high: "#f87171", medium: "#f59e0b", low: "#8a93a6" } as const;

export default async function OverviewPage() {
  const session = await getSession();
  if (session && !session.isAdmin) return <CoachDashboard />;

  const academy = await getAcademy();
  const d = await getDashboard();
  const inbox = await getInboxStats();
  const f = d.finance;

  const health = academyHealth({
    collected: f.collected,
    outstandingTotal: f.outstandingTotal,
    overdueTotal: f.overdueTotal,
    mrr: f.monthlyRecurringEstimate,
    unpaidAthletes: f.unpaidAthletes,
    occupancyPct: d.occupancyPct,
    statuses: d.enrollments.map((e) => e.status),
    fmt: (n) => fmtMoney(n),
  });

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={`${academy?.name} · ${academy?.location ?? ""} · Season ${academy?.season ?? ""}`}
        right={
          <Link href="/dashboard/alerts" className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)]">
            {d.alerts.length} alert{d.alerts.length === 1 ? "" : "s"} →
          </Link>
        }
      />

      <div className="space-y-6 p-8">
        {/* Academy AI — business health */}
        <AcademyHealthPanel health={health} mrrLabel="Monthly recurring" />

        {/* Operational KPIs */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Active athletes" value={String(d.activeAthletes)} hint="enrolled members" accent href="/dashboard/members" />
          <StatCard label="Applicants this month" value={String(d.applicantsThisMonth)} hint={`${d.accepted} accepted total`} href="/dashboard/applications" />
          <StatCard label="Active groups" value={String(d.activeGroups)} hint={`${d.occupancyPct}% occupancy`} href="/dashboard/groups" />
          <StatCard label="Coaches" value={String(d.coaches)} href="/dashboard/coaches" />
          <StatCard label="Monthly recurring est." value={fmtMoney(f.monthlyRecurringEstimate)} hint="from active contracts" href="/dashboard/payments" />
          <StatCard label="Active subscriptions" value={String(f.activeSubscriptions)} href="/dashboard/packages" />
          <StatCard label="Overdue payments" value={fmtMoney(f.overdueTotal)} hint={`${f.unpaidAthletes} athlete(s)`} danger={f.overdueTotal > 0} href="/dashboard/payments" />
          <StatCard label="Improving athletes" value={`${d.improving}/${d.totalActive}`} hint="positive FIS trend" href="/dashboard/members" />
          <StatCard label="Paid this month" value={fmtMoney(f.paidThisMonth)} href="/dashboard/payments" />
          <StatCard label="Missing documents" value={String(d.missingDocs)} danger={d.missingDocs > 0} href="/dashboard/documents" />
          <StatCard label="Expired documents" value={String(d.expiredDocs)} danger={d.expiredDocs > 0} href="/dashboard/documents" />
          <StatCard label="Open alerts" value={String(d.alerts.length)} danger={d.alerts.some((a) => a.severity === "high")} href="/dashboard/alerts" />
          <StatCard label="Unread messages" value={String(inbox.unreadTotal)} hint={`${inbox.waiting} waiting`} danger={inbox.unreadTotal > 0} href="/dashboard/inbox" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Alerts preview */}
          <div className="card p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Automation alerts</h2>
              <Link href="/dashboard/alerts" className="text-xs text-[var(--color-accent)] hover:underline">View all</Link>
            </div>
            <div className="space-y-1">
              {d.alerts.length === 0 && <p className="text-sm text-[var(--color-muted)]">No alerts — everything is on track.</p>}
              {d.alerts.slice(0, 6).map((a) => (
                <Link key={a.id} href={a.href ?? "#"} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--color-surface-2)]">
                  <Dot color={SEV_COLOR[a.severity]} />
                  <span className="text-sm font-medium">{a.title}</span>
                  <span className="truncate text-xs text-[var(--color-muted)]">{a.detail}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Package revenue breakdown */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold">Revenue by package</h2>
            <div className="space-y-3">
              {f.packageBreakdown.length === 0 && <p className="text-sm text-[var(--color-muted)]">No active contracts.</p>}
              {f.packageBreakdown.map((p) => {
                const pct = f.totalContract ? (p.revenue / f.totalContract) * 100 : 0;
                return (
                  <div key={p.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span>{p.name} <span className="text-[var(--color-muted)]">· {p.count}</span></span>
                      <span className="num">{fmtMoney(p.revenue, p.currency)}</span>
                    </div>
                    <PercentBar value={pct} />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-muted)]">
              Total contract value <span className="num font-semibold text-[var(--color-fg)]">{fmtMoney(f.totalContract)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

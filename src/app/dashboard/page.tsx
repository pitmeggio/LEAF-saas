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
    mrr: f.monthlyRecurring,
    unpaidAthletes: f.unpaidAthletes,
    occupancyPct: d.occupancyPct,
    statuses: d.enrollments.map((e) => e.status),
    fmt: (n) => fmtMoney(n, f.currency),
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
        {/* Today — LEAF triages everything; you only see what needs a human */}
        <div className="card p-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
            <h2 className="text-sm font-semibold">Today</h2>
          </div>
          {d.alerts.length === 0 ? (
            <p className="text-sm text-[var(--color-fg)]/85">
              ✓ You&apos;re all caught up. LEAF is auto-tracking {d.activeAthletes} athletes — payments, documents and performance.
            </p>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Academy AI — business health */}
        <AcademyHealthPanel health={health} mrrLabel="Monthly recurring" />

        {/* People */}
        <KpiGroup title="People">
          <StatCard label="Active athletes" value={String(d.activeAthletes)} hint="enrolled members" accent href="/dashboard/members" />
          <StatCard label="Applicants this month" value={String(d.applicantsThisMonth)} hint={`${d.accepted} accepted so far`} href="/dashboard/applications" />
          <StatCard label="Active groups" value={String(d.activeGroups)} hint={`${d.occupancyPct}% of spots filled`} href="/dashboard/groups" />
          <StatCard label="Coaches" value={String(d.coaches)} hint="on staff" href="/dashboard/coaches" />
        </KpiGroup>

        {/* Finance */}
        <KpiGroup title="Finance">
          <StatCard label="Monthly recurring" value={fmtMoney(f.monthlyRecurring, f.currency)} hint="avg/mo · last 3 months" href="/dashboard/payments" />
          <StatCard label="Paid this month" value={fmtMoney(f.paidThisMonth, f.currency)} hint="collected so far" href="/dashboard/payments" />
          <StatCard label="Overdue payments" value={fmtMoney(f.overdueTotal, f.currency)} hint={`${f.unpaidAthletes} athlete(s) to chase`} danger={f.overdueTotal > 0} href="/dashboard/payments" />
          <StatCard label="Active subscriptions" value={String(f.activeSubscriptions)} hint="athletes on a package" href="/dashboard/packages" />
        </KpiGroup>

        {/* Needs attention */}
        <KpiGroup title="Performance & to-do">
          <StatCard label="Improving athletes" value={`${d.improving}/${d.totalActive}`} hint="ranking trending up" href="/dashboard/members" />
          <StatCard label="Missing documents" value={String(d.missingDocs)} hint="need uploading" danger={d.missingDocs > 0} href="/dashboard/documents" />
          <StatCard label="Expired documents" value={String(d.expiredDocs)} hint="need renewing" danger={d.expiredDocs > 0} href="/dashboard/documents" />
          <StatCard label="Unread messages" value={String(inbox.unreadTotal)} hint={`${inbox.waiting} awaiting reply`} danger={inbox.unreadTotal > 0} href="/dashboard/inbox" />
        </KpiGroup>

        <div className="grid gap-6">
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
              Total contract value <span className="num font-semibold text-[var(--color-fg)]">{fmtMoney(f.totalContract, f.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function KpiGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="kicker mb-3">{title}</div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{children}</div>
    </div>
  );
}

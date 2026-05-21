import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, PercentBar, Dot } from "@/components/StatCard";
import { Avatar, TrendArrow } from "@/components/ui";
import { getActiveAthletes, getGroupsWithStats, computeAlerts, getExpenses } from "@/lib/ops";
import { getInboxStats } from "@/lib/chat";
import { getSession } from "@/lib/auth";
import { fmtMoney, DISCIPLINE_LABEL, age } from "@/lib/domain";

const SEV_COLOR = { high: "#f87171", medium: "#f59e0b", low: "#8a93a6" } as const;

export async function CoachDashboard() {
  const s = await getSession();
  const coachId = s?.coachId ?? null;
  const [members, groups, alerts, exp, inbox] = await Promise.all([
    getActiveAthletes(coachId),
    getGroupsWithStats(coachId),
    computeAlerts(coachId),
    getExpenses(coachId),
    getInboxStats(),
  ]);

  const improving = members.filter((m) => m.perf === "improving").length;
  const totalCap = groups.reduce((a, g) => a + g.capacity, 0);
  const inGroups = groups.reduce((a, g) => a + g.count, 0);
  const occupancy = totalCap ? Math.round((inGroups / totalCap) * 100) : 0;
  const remainingBudget = groups.reduce((a, g) => a + g.remainingBudget, 0);

  return (
    <>
      <PageHeader
        title="My Dashboard"
        subtitle={`${s?.name} · Coach workspace · ${s?.academyName ?? ""}`}
        right={<Link href="/dashboard/alerts" className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)]">{alerts.length} alerts →</Link>}
      />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="My athletes" value={String(members.length)} accent href="/dashboard/members" />
          <StatCard label="My groups" value={String(groups.length)} href="/dashboard/groups" />
          <StatCard label="Improving" value={`${improving}/${members.length}`} hint="positive FIS trend" href="/dashboard/members" />
          <StatCard label="Group occupancy" value={`${occupancy}%`} hint={`${inGroups}/${totalCap}`} href="/dashboard/groups" />
          <StatCard label="Budget remaining" value={fmtMoney(remainingBudget)} danger={remainingBudget < 0} href="/dashboard/groups" />
          <StatCard label="Unread messages" value={String(inbox.unreadTotal)} hint={`${inbox.waiting} waiting`} danger={inbox.unreadTotal > 0} href="/dashboard/inbox" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* My groups budget */}
          <div className="card p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">My groups</h2><Link href="/dashboard/groups" className="text-xs text-[var(--color-accent)] hover:underline">View</Link></div>
            <div className="space-y-4">
              {groups.length === 0 && <p className="text-sm text-[var(--color-muted)]">No groups assigned.</p>}
              {groups.map((g) => (
                <div key={g.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{g.name} {g.overCapacity && <span className="text-[10px] text-[#f87171]">OVER</span>}</span>
                    <span className="num text-xs text-[var(--color-muted)]">{g.count}/{g.capacity} · budget {fmtMoney(g.remainingBudget)} left</span>
                  </div>
                  <PercentBar value={g.occupancyPct} color={g.overCapacity ? "#f87171" : "var(--color-accent)"} />
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Alerts</h2><Link href="/dashboard/alerts" className="text-xs text-[var(--color-accent)] hover:underline">All</Link></div>
            <div className="space-y-1">
              {alerts.length === 0 && <p className="text-sm text-[var(--color-muted)]">All clear.</p>}
              {alerts.slice(0, 6).map((a) => (
                <Link key={a.id} href={a.href ?? "#"} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-2)]">
                  <Dot color={SEV_COLOR[a.severity]} />
                  <span className="truncate text-xs">{a.title} · <span className="text-[var(--color-muted)]">{a.detail}</span></span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* My athletes */}
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-5 py-4"><h2 className="text-sm font-semibold">My athletes</h2></div>
          <table className="w-full text-sm">
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-[var(--color-border)] first:border-t-0 hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/members/${m.id}`} className="flex items-center gap-3">
                      <Avatar first={m.athlete.firstName} last={m.athlete.lastName} color={m.athlete.photoColor} size={32} />
                      <span className="font-medium">{m.athlete.firstName} {m.athlete.lastName}</span>
                      <span className="text-xs text-[var(--color-muted)]">{age(m.athlete.dob)}y · {DISCIPLINE_LABEL[m.athlete.discipline]}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right"><TrendArrow trend={m.trend} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

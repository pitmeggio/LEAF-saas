import Link from "next/link";
import { Users, Layers, TrendingUp, Gauge, Wallet, Mail, Bell, Activity, Sparkles, ArrowRight, Receipt } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, PercentBar, Dot } from "@/components/StatCard";
import { PulseGauge, type PulseStatus } from "@/components/PulseGauge";
import { Avatar, TrendArrow } from "@/components/ui";
import { getActiveAthletes, getGroupsWithStats, computeAlerts, getExpenses, getAcademyCurrency, getCoachIntelligenceSummary } from "@/lib/ops";
import { getInboxStats } from "@/lib/chat";
import { getSession } from "@/lib/auth";
import { fmtMoney, DISCIPLINE_LABEL, age } from "@/lib/domain";
import { deriveCoachSummary } from "@/lib/ai/coachSummary";

const SEV_COLOR = { high: "#f87171", medium: "#f59e0b", low: "#8a93a6" } as const;
const KIND_COLOR = { strength: "var(--color-accent)", watch: "#f59e0b", info: "var(--color-muted)" } as const;

export async function CoachDashboard() {
  const s = await getSession();
  const coachId = s?.coachId ?? null;
  const [members, groups, alerts, exp, inbox, currency, intel] = await Promise.all([
    getActiveAthletes(coachId),
    getGroupsWithStats(coachId),
    computeAlerts(coachId),
    getExpenses(coachId),
    getInboxStats(),
    getAcademyCurrency(),
    getCoachIntelligenceSummary(coachId),
  ]);

  const improving = members.filter((m) => m.perf === "improving").length;
  const totalCap = groups.reduce((a, g) => a + g.capacity, 0);
  const inGroups = groups.reduce((a, g) => a + g.count, 0);
  const occupancy = totalCap ? Math.round((inGroups / totalCap) * 100) : 0;
  const remainingBudget = groups.reduce((a, g) => a + g.remainingBudget, 0);

  // Coach pulse — four glanceable signals, same convention as the academy
  // pulse (ring fills toward "good"). All derived from data already loaded.
  const rosterStatus: PulseStatus = occupancy > 105 ? "bad" : occupancy >= 60 ? "good" : "watch";
  const totalBudget = groups.reduce((a, g) => a + (g.budget ?? 0), 0);
  const usedPct = totalBudget > 0 ? Math.round(((totalBudget - remainingBudget) / totalBudget) * 100) : 0;
  const headroom = Math.max(0, Math.min(100, 100 - usedPct));
  const budgetStatus: PulseStatus = usedPct > 100 ? "bad" : usedPct > 85 ? "watch" : "good";
  const unread = inbox.unreadTotal;
  const inboxCalm = unread === 0 ? 100 : Math.max(15, 100 - unread * 18);
  const inboxStatus: PulseStatus = unread === 0 ? "good" : unread <= 3 ? "watch" : "bad";
  const attnCalm = alerts.length === 0 ? 100 : Math.max(15, 100 - alerts.length * 18);
  const attnStatus: PulseStatus = alerts.length === 0 ? "good" : alerts.length <= 2 ? "watch" : "bad";

  // My-expenses rollup — mirrors the admin expense strip at coach altitude so
  // the coach sees the same money picture for their own claims (awaiting
  // approval vs owed back to them).
  const expReimbursable = exp.approvedTotal - exp.reimbursedTotal; // approved, not yet paid back
  const expDraftCount = exp.expenses.filter((e) => e.status === "draft").length;

  const nameOf = (m: { athlete: { firstName: string; lastName: string } }) => `${m.athlete.firstName} ${m.athlete.lastName}`;
  const briefing = deriveCoachSummary({
    athleteCount: members.length,
    improvingNames: members.filter((m) => m.perf === "improving").map(nameOf),
    decliningNames: members.filter((m) => m.perf === "declining").map(nameOf),
    overdue: alerts.filter((a) => a.type === "payment_overdue").length,
    docIssues: alerts.filter((a) => a.type === "missing_document").length,
  });

  return (
    <>
      <PageHeader
        title="My Dashboard"
        subtitle={`${s?.name} · Coach workspace · ${s?.academyName ?? ""}`}
        right={<Link href="/dashboard/alerts" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)]">{alerts.length} alerts<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>}
      />
      <div className="space-y-6 p-8">
        {/* Coach pulse — signature glance: four live health rings. */}
        <div className="card p-6">
          <div className="mb-5 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />
            <h2 className="text-sm font-semibold">My pulse</h2>
            <span className="text-[11px] text-[var(--color-muted)]">live signals · your squad</span>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <PulseGauge icon={Users} value={Math.min(100, occupancy)} status={rosterStatus} center={`${occupancy}%`} label="Roster" sub={`${inGroups}/${totalCap} spots filled`} />
            <PulseGauge icon={Wallet} value={headroom} status={budgetStatus} center={`${headroom}%`} label="Budget left" sub={`${usedPct}% used`} />
            <PulseGauge icon={Mail} value={inboxCalm} status={inboxStatus} center={String(unread)} label="Inbox" sub={unread === 0 ? "all read" : "unread"} />
            <PulseGauge icon={Bell} value={attnCalm} status={attnStatus} center={String(alerts.length)} label="Attention" sub={alerts.length === 0 ? "all clear" : `item${alerts.length === 1 ? "" : "s"} need you`} />
          </div>
        </div>

        {/* Academy AI — coach briefing */}
        <div className="card p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}><Sparkles className="h-3 w-3" aria-hidden />AI</span>
            <h2 className="text-sm font-semibold">This week’s briefing</h2>
          </div>
          <p className="text-sm font-medium">{briefing.headline}</p>
          {briefing.lines.length > 0 && (
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {briefing.lines.map((l, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_COLOR[l.kind] }} />
                  <span className="text-[var(--color-fg)]/85">{l.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Coach Intelligence — adaptive notes + AI profile rollup across the roster */}
        {(intel.totalNotes > 0 || intel.watchlist.length > 0) && (
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}><Sparkles className="h-3 w-3" aria-hidden />AI</span>
                <h2 className="text-sm font-semibold">Coach intelligence</h2>
              </div>
              <span className="text-[11px] text-[var(--color-muted)]">
                {intel.totalNotes} note{intel.totalNotes === 1 ? "" : "s"} on file
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {/* Watchlist — athletes whose AI profile flags something */}
              <div className="lg:col-span-2">
                <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Watchlist — athletes that need a look</div>
                {intel.watchlist.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted)]">No active flags across your roster.</p>
                ) : (
                  <div className="space-y-2">
                    {intel.watchlist.slice(0, 4).map((w) => (
                      <Link
                        key={w.enrollmentId}
                        href={`/dashboard/athletes/${w.enrollmentId}`}
                        className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 hover:border-[var(--color-accent)]"
                      >
                        <Avatar first={w.firstName} last={w.lastName} color={w.photoColor} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate text-sm font-medium">{w.firstName} {w.lastName}</span>
                            {w.injuryFlags.length > 0 && (
                              <span className="rounded-md bg-[#f8717120] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#f87171]">Injury</span>
                            )}
                          </div>
                          {w.injuryFlags.length > 0 && (
                            <div className="mt-0.5 truncate text-[11px] text-[#f87171]">{w.injuryFlags[0]}</div>
                          )}
                          {w.topWeakness && w.injuryFlags.length === 0 && (
                            <div className="mt-0.5 truncate text-[11px] text-[#f59e0b]">Weakness: {w.topWeakness}</div>
                          )}
                          {w.topPriority && (
                            <div className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]">Next focus: {w.topPriority}</div>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-muted)]" aria-hidden />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Coach lens — theme balance across the roster */}
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Your coaching lens</div>
                {intel.themeBalance.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted)]">Add a note to start building your lens.</p>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const max = Math.max(1, ...intel.themeBalance.map((t) => t.count));
                      return intel.themeBalance.map((t) => (
                        <div key={t.theme}>
                          <div className="mb-0.5 flex items-center justify-between text-[11px]">
                            <span className="capitalize">{t.theme}</span>
                            <span className="num text-[var(--color-muted)]">{t.count}</span>
                          </div>
                          <PercentBar value={(t.count / max) * 100} />
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Recent notes — last activity across the roster */}
            {intel.recentNotes.length > 0 && (
              <div className="mt-5 border-t border-[var(--color-border)] pt-4">
                <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Recent notes</div>
                <ul className="space-y-1.5">
                  {intel.recentNotes.slice(0, 5).map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/dashboard/athletes/${n.enrollmentId}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
                      >
                        <Avatar first={n.athleteFirstName} last={n.athleteLastName} color={n.athletePhotoColor} size={22} />
                        <span className="text-xs font-medium">{n.athleteName}</span>
                        {n.kind && (
                          <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[9px] uppercase tracking-wide text-[var(--color-muted)]">{n.kind.replace(/_/g, " ")}</span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-muted)]">{n.rawText}</span>
                        <span className="shrink-0 text-[10px] text-[var(--color-muted)]">{new Date(n.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="My athletes" value={String(members.length)} accent href="/dashboard/athletes" icon={Users} />
          <StatCard label="My groups" value={String(groups.length)} href="/dashboard/groups" icon={Layers} />
          <StatCard label="Improving" value={`${improving}/${members.length}`} hint="positive FIS trend" href="/dashboard/athletes" icon={TrendingUp} />
          <StatCard label="Group occupancy" value={`${occupancy}%`} hint={`${inGroups}/${totalCap}`} href="/dashboard/groups" icon={Gauge} />
          <StatCard label="Budget remaining" value={fmtMoney(remainingBudget, currency)} danger={remainingBudget < 0} href="/dashboard/groups" icon={Wallet} />
          <StatCard label="Unread messages" value={String(inbox.unreadTotal)} hint={`${inbox.waiting} waiting`} danger={inbox.unreadTotal > 0} href="/dashboard/inbox" icon={Mail} />
        </div>

        {/* My expenses — coach view of their own claims. Mirrors the admin
            expense KPIs so the coach tracks what's awaiting approval and what
            the academy still owes them, with a one-click file/mileage entry. */}
        <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Awaiting approval</div>
              <div className="num text-lg font-bold">{fmtMoney(exp.submittedTotal, currency)}</div>
              <div className="text-[10px] text-[var(--color-muted)]">{exp.pendingCount} claim{exp.pendingCount === 1 ? "" : "s"}{expDraftCount > 0 ? ` · ${expDraftCount} draft` : ""}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Owed to me</div>
              <div className="num text-lg font-bold" style={{ color: expReimbursable > 0 ? "#f59e0b" : undefined }}>{fmtMoney(expReimbursable, currency)}</div>
              <div className="text-[10px] text-[var(--color-muted)]">approved, not reimbursed</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Reimbursed</div>
              <div className="num text-lg font-bold">{fmtMoney(exp.reimbursedTotal, currency)}</div>
              <div className="text-[10px] text-[var(--color-muted)]">paid back</div>
            </div>
          </div>
          <Link href="/dashboard/expenses" className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
            <Receipt className="h-4 w-4" aria-hidden />File expense / mileage
          </Link>
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
                    <span className="num text-xs text-[var(--color-muted)]">{g.count}/{g.capacity} · budget {fmtMoney(g.remainingBudget, currency)} left</span>
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
                    <Link href={`/dashboard/athletes/${m.id}`} className="flex items-center gap-3">
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

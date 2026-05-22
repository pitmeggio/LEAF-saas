import { PageHeader } from "@/components/PageHeader";
import { PercentBar } from "@/components/StatCard";
import { getActiveAthletes, getFinance, getGroupsWithStats, getDocumentsData } from "@/lib/ops";
import { getAcademy } from "@/lib/queries";
import { requireAdmin } from "@/lib/auth";
import { fmtMoney, fmtDate, PERF_COLOR } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireAdmin();
  const [academy, members, finance, groups, docs] = await Promise.all([
    getAcademy(), getActiveAthletes(), getFinance(), getGroupsWithStats(), getDocumentsData(),
  ]);

  const perf = {
    improving: members.filter((m) => m.perf === "improving").length,
    stable: members.filter((m) => m.perf === "stable").length,
    declining: members.filter((m) => m.perf === "declining").length,
  };
  const byStatus = (s: string) => members.filter((m) => m.status === s).length;
  const totalCap = groups.reduce((s, g) => s + g.capacity, 0);
  const inGroups = groups.reduce((s, g) => s + g.count, 0);
  const docTotal = docs.docs.length || 1;
  const compliant = docs.docs.filter((d) => d.status === "verified" || d.status === "uploaded").length;

  return (
    <>
      <PageHeader title="Reports" subtitle={`Auto-generated from current data · ${fmtDate(new Date())}`} />
      <div className="grid gap-6 p-8 lg:grid-cols-2">
        <Section title="Roster summary" subtitle="your athletes by current status">
          <Line label="Active athletes" value={String(members.length)} />
          <Line label="Active" value={String(byStatus("active"))} />
          <Line label="Injured" value={String(byStatus("injured"))} />
          <Line label="Paused" value={String(byStatus("paused"))} />
        </Section>

        <Section title="Performance summary" subtitle="ranking direction across the squad">
          <Bars items={[
            { label: "Improving", value: perf.improving, color: PERF_COLOR.improving },
            { label: "Stable", value: perf.stable, color: PERF_COLOR.stable },
            { label: "Declining", value: perf.declining, color: PERF_COLOR.declining },
          ]} total={members.length || 1} />
        </Section>

        <Section title="Financial summary" subtitle="the season's money at a glance">
          <Line label="Total contract value" hint="all active deals combined" value={fmtMoney(finance.totalContract)} />
          <Line label="Monthly recurring" hint="expected income / month" value={fmtMoney(finance.monthlyRecurringEstimate)} />
          <Line label="Paid this month" hint="collected so far" value={fmtMoney(finance.paidThisMonth)} />
          <Line label="Overdue" hint="past due date" value={fmtMoney(finance.overdueTotal)} danger />
          <Line label="Active subscriptions" hint="athletes on a package" value={String(finance.activeSubscriptions)} />
        </Section>

        <Section title="Capacity & compliance" subtitle="spots used + documents in order">
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-xs"><span className="text-[var(--color-muted)]">Group occupancy</span><span className="num">{inGroups}/{totalCap}</span></div>
            <PercentBar value={totalCap ? (inGroups / totalCap) * 100 : 0} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs"><span className="text-[var(--color-muted)]">Document compliance</span><span className="num">{compliant}/{docs.docs.length}</span></div>
            <PercentBar value={(compliant / docTotal) * 100} color={docs.missing.length ? "#f59e0b" : "var(--color-accent)"} />
          </div>
          <div className="mt-3 text-xs text-[var(--color-muted)]">{docs.missing.length} missing · {docs.expired.length} expired</div>
        </Section>

        <div className="lg:col-span-2">
          <Section title="Budget allocation by team" subtitle="margin = revenue − coach cost, per group">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <th className="py-2 font-medium">Team</th>
                  <th className="py-2 font-medium">Athletes</th>
                  <th className="py-2 font-medium">Revenue</th>
                  <th className="py-2 font-medium">Coach cost</th>
                  <th className="py-2 font-medium">Budget</th>
                  <th className="py-2 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-t border-[var(--color-border)]">
                    <td className="py-2">{g.name}{g.overCapacity && <span className="ml-2 text-[10px] font-semibold text-[#f87171]">OVER</span>}</td>
                    <td className="num py-2">{g.count}/{g.capacity}</td>
                    <td className="num py-2">{fmtMoney(g.revenue)}</td>
                    <td className="num py-2 text-[var(--color-muted)]">{fmtMoney(g.coachCost)}</td>
                    <td className="num py-2 text-[var(--color-muted)]">{fmtMoney(g.budget)}</td>
                    <td className="num py-2 font-semibold" style={{ color: g.marginPositive ? "var(--color-accent)" : "#f87171" }}>{fmtMoney(g.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="mb-4 mt-0.5 text-xs text-[var(--color-muted)]">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      <div className="space-y-2.5 text-sm">{children}</div>
    </div>
  );
}
function Line({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-[var(--color-muted)]">
        {label}
        {hint && <span className="block text-[11px] opacity-70">{hint}</span>}
      </span>
      <span className="num font-semibold" style={danger ? { color: "#f87171" } : undefined}>{value}</span>
    </div>
  );
}
function Bars({ items, total }: { items: { label: string; value: number; color: string }[]; total: number }) {
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex justify-between text-xs"><span>{it.label}</span><span className="num">{it.value}</span></div>
          <PercentBar value={(it.value / total) * 100} color={it.color} />
        </div>
      ))}
    </div>
  );
}

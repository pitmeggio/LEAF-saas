import { PageHeader } from "@/components/PageHeader";
import { PercentBar } from "@/components/StatCard";
import { Modal, GroupForm, DeleteButton } from "@/components/EntityForms";
import { getGroupsWithStats, getAssignmentOptions, getAcademyCurrency } from "@/lib/ops";
import { getSession } from "@/lib/auth";
import { fmtMoney } from "@/lib/domain";

export const dynamic = "force-dynamic";

const newBtn = "rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]";

export default async function GroupsPage() {
  const s = await getSession();
  const isAdmin = s?.isAdmin ?? false;
  const coachScope = isAdmin ? null : s?.coachId ?? null;
  const [groups, opts, currency] = await Promise.all([getGroupsWithStats(coachScope), getAssignmentOptions(), getAcademyCurrency()]);

  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex justify-between"><dt className="text-[var(--color-muted)]">{label}</dt><dd className="num" style={color ? { color } : undefined}>{value}</dd></div>
  );

  return (
    <>
      <PageHeader
        title={isAdmin ? "Groups / Teams" : "My Groups"}
        subtitle={isAdmin ? "Occupancy, revenue and budget per team." : "Your teams — occupancy and budget usage."}
        right={isAdmin ? <Modal label="+ New group" title="New group" className={newBtn}><GroupForm coaches={opts.coaches} /></Modal> : undefined}
      />
      <div className="grid gap-4 p-8 sm:grid-cols-2 lg:grid-cols-3">
        {groups.length === 0 && <p className="text-sm text-[var(--color-muted)]">No groups assigned.</p>}
        {groups.map((g) => (
          <div key={g.id} className="card p-5" style={g.overCapacity || g.overBudget ? { borderColor: "#f87171" } : undefined}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold">{g.name}</div>
                <div className="text-xs text-[var(--color-muted)]">{g.coach?.name ?? "No coach"} · Season {g.season}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {g.overCapacity && <span className="rounded-md bg-[#f8717120] px-2 py-0.5 text-[10px] font-semibold text-[#f87171]">OVER CAPACITY</span>}
                {g.overBudget && <span className="rounded-md bg-[#f8717120] px-2 py-0.5 text-[10px] font-semibold text-[#f87171]">OVER BUDGET</span>}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--color-muted)]">Occupancy</span>
                <span className="num">{g.count}/{g.capacity} · {g.occupancyPct}%</span>
              </div>
              <PercentBar value={g.occupancyPct} color={g.overCapacity ? "#f87171" : g.occupancyPct > 85 ? "#f59e0b" : "var(--color-accent)"} />
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-[var(--color-border)] pt-3 text-sm">
              <Row label="Athletes" value={String(g.count)} />
              <Row label="Contract revenue" value={fmtMoney(g.revenue, currency)} />
              <Row label="Collected" value={fmtMoney(g.collectedRevenue, currency)} color="var(--color-accent)" />
              {isAdmin && <Row label="Coach cost" value={fmtMoney(g.coachCost, currency)} />}
              <Row label="Budget allocation" value={fmtMoney(g.budget, currency)} />
              <Row label="Used budget" value={fmtMoney(g.usedBudget, currency)} />
              <Row label="Remaining" value={fmtMoney(g.remainingBudget, currency)} color={g.remainingBudget < 0 ? "#f87171" : undefined} />
              <Row label="Pending expenses" value={fmtMoney(g.pendingExpenses, currency)} />
              {isAdmin && (
                <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5">
                  <dt className="font-medium">Est. margin</dt>
                  <dd className="num font-semibold" style={{ color: g.marginPositive ? "var(--color-accent)" : "#f87171" }}>{fmtMoney(g.margin, currency)}</dd>
                </div>
              )}
            </dl>

            {isAdmin && (
              <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
                <Modal label="Edit" title="Edit group" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
                  <GroupForm coaches={opts.coaches} initial={{ id: g.id, name: g.name, season: g.season, coachId: g.coachId, capacity: g.capacity, notes: g.notes, active: g.active, pointsMin: g.pointsMin, pointsMax: g.pointsMax, ageMin: g.ageMin, ageMax: g.ageMax, level: g.level, discipline: g.discipline }} />
                </Modal>
                <DeleteButton kind="group" id={g.id} label="Delete" />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

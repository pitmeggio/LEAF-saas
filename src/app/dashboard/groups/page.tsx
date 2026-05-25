import { PageHeader } from "@/components/PageHeader";
import { PercentBar } from "@/components/StatCard";
import { Modal, GroupForm, DeleteButton } from "@/components/EntityForms";
import { getGroupsWithStats, getAssignmentOptions, getAcademyCurrency } from "@/lib/ops";
import { getSession } from "@/lib/auth";
import { LEVEL_LABEL } from "@/lib/domain";

export const dynamic = "force-dynamic";

const newBtn = "rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]";

// Groups is now an OPERATIONAL view only — roster, coach, capacity, discipline
// split, training category. Anything financial lives in Finance → Budgets.
export default async function GroupsPage() {
  const s = await getSession();
  const isAdmin = s?.isAdmin ?? false;
  const coachScope = isAdmin ? null : s?.coachId ?? null;
  const [groups, opts, currency] = await Promise.all([getGroupsWithStats(coachScope), getAssignmentOptions(), getAcademyCurrency()]);

  return (
    <>
      <PageHeader
        title={isAdmin ? "Groups / Teams" : "My Groups"}
        subtitle="Roster, coaches, capacity and discipline composition."
        right={isAdmin ? <Modal label="+ New group" title="New group" className={newBtn}><GroupForm coaches={opts.coaches} currency={currency} /></Modal> : undefined}
      />
      <div className="grid gap-4 p-8 sm:grid-cols-2 lg:grid-cols-3">
        {groups.length === 0 && <p className="text-sm text-[var(--color-muted)]">No groups assigned.</p>}
        {groups.map((g) => (
          <div key={g.id} className="card p-5" style={g.overCapacity ? { borderColor: "#f87171" } : undefined}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold">{g.name}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {g.coach?.name ?? "No coach"} · Season {g.season}
                  {g.level ? ` · ${LEVEL_LABEL[g.level] ?? g.level}` : ""}
                </div>
              </div>
              {g.overCapacity && <span className="rounded-md bg-[#f8717120] px-2 py-0.5 text-[10px] font-semibold text-[#f87171]">OVER CAPACITY</span>}
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--color-muted)]">Occupancy</span>
                <span className="num">{g.count}/{g.capacity} · {g.occupancyPct}%</span>
              </div>
              <PercentBar value={g.occupancyPct} color={g.overCapacity ? "#f87171" : g.occupancyPct > 85 ? "#f59e0b" : "var(--color-accent)"} />
            </div>

            {/* Discipline split — operational composition (SL / GS / Speed / …) */}
            {g.disciplineSplit.length > 0 && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Discipline split</div>
                <div className="flex flex-wrap gap-1.5">
                  {g.disciplineSplit.map((d) => (
                    <span key={d.discipline} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-surface-2)] px-2 py-1 text-[11px]">
                      <span className="font-semibold">{d.discipline}</span>
                      <span className="num text-[var(--color-muted)]">· {d.count}</span>
                      <span className="num text-[10px] text-[var(--color-muted)]/70">({d.pct}%)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Group assignment rules (Smart Group Assignment) — read-only summary */}
            {(g.pointsMin != null || g.pointsMax != null || g.ageMin != null || g.ageMax != null || g.discipline) && (
              <div className="mt-3 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-muted)]">
                <div className="mb-1 text-[10px] uppercase tracking-wide">Assignment rules</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {(g.pointsMin != null || g.pointsMax != null) && <span>Points <span className="num text-[var(--color-fg)]">{g.pointsMin ?? "–"}–{g.pointsMax ?? "–"}</span></span>}
                  {(g.ageMin != null || g.ageMax != null) && <span>Age <span className="num text-[var(--color-fg)]">{g.ageMin ?? "–"}–{g.ageMax ?? "–"}</span></span>}
                  {g.discipline && <span>Discipline <span className="text-[var(--color-fg)]">{g.discipline}</span></span>}
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
                <Modal label="Edit" title="Edit group" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
                  <GroupForm coaches={opts.coaches} currency={currency} initial={{ id: g.id, name: g.name, season: g.season, coachId: g.coachId, capacity: g.capacity, notes: g.notes, active: g.active, budget: g.budget, budgetHardStop: g.budgetHardStop, pointsMin: g.pointsMin, pointsMax: g.pointsMax, ageMin: g.ageMin, ageMax: g.ageMax, level: g.level, discipline: g.discipline }} />
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

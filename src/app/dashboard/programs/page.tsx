import { PageHeader } from "@/components/PageHeader";
import { ProgramFormButton } from "@/components/ProgramFormButton";
import { ProgramActions } from "@/components/ProgramActions";
import { getProgramsForOps } from "@/lib/programs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/domain";
import { programKindLabel, type LineupRow } from "@/lib/trainingProgram";

export const dynamic = "force-dynamic";

const newBtn = "rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]";
const editBtn = "rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-2)]";

export default async function ProgramsPage() {
  const s = await getSession();
  const isAdmin = s?.isAdmin ?? false;
  const coachId = isAdmin ? null : s?.coachId ?? null;
  const academyId = s?.academyId ?? "";

  const [programs, groups] = await Promise.all([
    getProgramsForOps(coachId),
    prisma.group.findMany({ where: { academyId, ...(coachId ? { coachId } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Roster per group, to seed the lineup in the form.
  const enrollments = await prisma.enrollment.findMany({
    where: { academyId, groupId: { in: groups.map((g) => g.id) }, status: { in: ["active", "accepted", "injured", "paused"] } },
    select: { groupId: true, athlete: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  });
  const groupAthletes: Record<string, { id: string; name: string }[]> = {};
  for (const e of enrollments) {
    if (!e.groupId) continue;
    (groupAthletes[e.groupId] ??= []).push({ id: e.athlete.id, name: `${e.athlete.firstName} ${e.athlete.lastName}` });
  }

  return (
    <>
      <PageHeader
        title="Programmi"
        subtitle="Crea il programma di allenamento o gara e pubblicalo: gli atleti del gruppo lo ricevono nell'app."
        right={<ProgramFormButton groups={groups} groupAthletes={groupAthletes} label="+ Nuovo programma" className={newBtn} />}
      />
      <div className="space-y-3 p-8">
        {programs.length === 0 && (
          <div className="card p-10 text-center text-sm text-[var(--color-muted)]">Nessun programma. Crea il primo allenamento o gara.</div>
        )}
        {programs.map((p) => {
          const lineup = Array.isArray(p.lineup) ? (p.lineup as unknown as LineupRow[]) : [];
          const initial = {
            id: p.id, kind: p.kind, title: p.title, place: p.place, discipline: p.discipline,
            date: new Date(p.date).toISOString().slice(0, 10), groupId: p.groupId,
            fields: (p.fields ?? {}) as Record<string, string>, lineup,
          };
          return (
            <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    {p.kind === "race" ? "🏁 Gara" : "🎿 Allenamento"}
                  </span>
                  <span className="font-medium">{p.title || p.place || programKindLabel(p.kind)}</span>
                  {p.status === "published"
                    ? <span className="text-[10px] font-medium text-[var(--color-accent)]">● pubblicato</span>
                    : <span className="text-[10px] text-[var(--color-muted)]">○ bozza</span>}
                </div>
                <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {fmtDate(p.date)}{p.groupName ? ` · ${p.groupName}` : ""}{p.discipline ? ` · ${p.discipline}` : ""}{lineup.length ? ` · ${lineup.length} atleti` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ProgramFormButton groups={groups} groupAthletes={groupAthletes} initial={initial} label="Modifica" className={editBtn} />
                <ProgramActions id={p.id} status={p.status} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

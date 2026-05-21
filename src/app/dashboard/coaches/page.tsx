import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/ui";
import { Modal, CoachForm, DeleteButton } from "@/components/EntityForms";
import { ArchiveCoachButton } from "@/components/EntityActions";
import { getCoachesWithStats } from "@/lib/ops";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { head_coach: "Head coach", coach: "Coach", physio: "Physio", s_and_c: "Strength & conditioning" };
const newBtn = "rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]";

export default async function CoachesPage() {
  await requireAdmin();
  const coaches = await getCoachesWithStats();
  const maxWorkload = Math.max(...coaches.map((c) => c.workload), 1);

  return (
    <>
      <PageHeader title="Coaches" subtitle="Workload, athlete and group counts update automatically." right={<Modal label="+ New coach" title="New coach" className={newBtn}><CoachForm /></Modal>} />
      <div className="grid gap-4 p-8 sm:grid-cols-2 lg:grid-cols-3">
        {coaches.map((c) => (
          <div key={c.id} className="card p-5" style={!c.active ? { opacity: 0.6 } : undefined}>
            <div className="flex items-center gap-3">
              <Avatar first={c.name.split(" ")[0] ?? ""} last={c.name.split(" ")[1] ?? ""} color="#38bdf8" size={44} />
              <div className="flex-1">
                <div className="font-semibold">{c.name}{!c.active && <span className="ml-2 text-[10px] uppercase text-[var(--color-muted)]">archived</span>}</div>
                <div className="text-xs text-[var(--color-muted)]">{ROLE_LABEL[c.role] ?? c.role}</div>
              </div>
            </div>
            {c.specialization && <div className="mt-3 text-sm text-[var(--color-muted)]">{c.specialization}</div>}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat value={c.athleteCount} label="Athletes" />
              <Stat value={c.groupCount} label="Groups" />
              <Stat value={c.workload} label="Workload" />
            </div>
            <div className="mt-4">
              <div className="mb-1 text-xs text-[var(--color-muted)]">Relative workload</div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                <div className="h-full rounded-full" style={{ width: `${(c.workload / maxWorkload) * 100}%`, background: c.workload / maxWorkload > 0.85 ? "#f59e0b" : "var(--color-accent)" }} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
              <Modal label="Edit" title="Edit coach" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
                <CoachForm initial={{ id: c.id, name: c.name, email: c.email, phone: c.phone, role: c.role, specialization: c.specialization, notes: c.notes, active: c.active }} />
              </Modal>
              <ArchiveCoachButton id={c.id} active={c.active} />
              <DeleteButton kind="coach" id={c.id} label="Delete" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="card-2 p-2">
      <div className="num text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

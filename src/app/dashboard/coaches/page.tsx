import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/ui";
import { Modal, CoachForm, DeleteButton } from "@/components/EntityForms";
import { ArchiveCoachButton } from "@/components/EntityActions";
import { CoachLoginButton } from "@/components/CoachLoginButton";
import { getCoachesWithStats, getAcademyCurrency } from "@/lib/ops";
import { requireAdmin } from "@/lib/auth";
import { fmtMoney } from "@/lib/domain";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { head_coach: "Maestro responsabile", coach: "Maestro", physio: "Fisioterapista", s_and_c: "Preparatore atletico", assistant_coach: "Maestro assistente" };
const newBtn = "rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]";

export default async function CoachesPage() {
  await requireAdmin();
  const [coaches, currency] = await Promise.all([getCoachesWithStats(), getAcademyCurrency()]);

  return (
    <>
      <PageHeader
        title="Maestri"
        subtitle="Ogni scheda mostra gli atleti seguiti e l'andamento della loro classifica — aggiornato in automatico."
        right={<Modal label="+ Nuovo maestro" title="Nuovo maestro" className={newBtn}><CoachForm /></Modal>}
      />
      <div className="grid gap-4 p-8 sm:grid-cols-2 lg:grid-cols-3">
        {coaches.map((c) => {
          const t = c.teamTrend;
          const tracked = t.improving + t.stable + t.declining;
          const improvingPct = tracked > 0 ? Math.round((t.improving / tracked) * 100) : 0;
          const decliningPct = tracked > 0 ? Math.round((t.declining / tracked) * 100) : 0;
          const stablePct = tracked > 0 ? 100 - improvingPct - decliningPct : 0;
          const avgSign = t.avgDelta < 0 ? "−" : t.avgDelta > 0 ? "+" : "±";
          const avgColor = t.avgDelta < 0 ? "var(--color-accent)" : t.avgDelta > 0 ? "#f87171" : "var(--color-muted)";
          // Headline read: choose the dominant signal.
          let headline = "Nessuna classifica ancora";
          let headlineColor: string = "var(--color-muted)";
          if (tracked > 0) {
            if (t.improving > t.declining) {
              headline = `${t.improving} in crescita · ${t.declining} in calo`;
              headlineColor = "var(--color-accent)";
            } else if (t.declining > t.improving) {
              headline = `${t.declining} in calo · ${t.improving} in crescita`;
              headlineColor = "#f87171";
            } else {
              headline = `${t.stable} stabili · ${t.improving} in crescita`;
              headlineColor = "var(--color-muted)";
            }
          }

          return (
          <div key={c.id} className="card p-5" style={!c.active ? { opacity: 0.6 } : undefined}>
            <div className="flex items-center gap-3">
              <Avatar first={c.name.split(" ")[0] ?? ""} last={c.name.split(" ")[1] ?? ""} color="#38bdf8" size={44} />
              <div className="flex-1">
                <div className="font-semibold">{c.name}{!c.active && <span className="ml-2 text-[10px] uppercase text-[var(--color-muted)]">archiviato</span>}</div>
                <div className="text-xs text-[var(--color-muted)]">{ROLE_LABEL[c.role] ?? c.role}</div>
              </div>
            </div>
            {c.specialization && <div className="mt-3 text-sm text-[var(--color-muted)]">{c.specialization}</div>}

            {/* Group names so the card says "Head of Development 1" rather
                than the abstract "1 GROUPS" count — operators need to see
                WHICH team the coach is responsible for at a glance. */}
            {c.groupNames.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.groupNames.map((name) => (
                  <span key={name} className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px]">
                    {name}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat value={c.athleteCount} label="Atleti" />
              <Stat value={c.groupCount} label="Gruppi" />
              <StatMoney value={c.cost ? fmtMoney(c.cost, currency) : "—"} label="Costo / stagione" />
            </div>

            {/* Team trend — replaces the old "workload" score. Reads the FIS
                points trend per primary discipline across the coach's active
                roster and surfaces the dominant signal + a stacked bar of
                improving / stable / declining shares. */}
            <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Andamento squadra</span>
                </div>
                <span className="text-[10px] text-[var(--color-muted)]">
                  {tracked > 0 ? `/ con classifica` : "0 con classifica"}
                </span>
              </div>
              <div className="text-sm font-medium" style={{ color: headlineColor }}>{headline}</div>
              {tracked > 0 ? (
                <>
                  <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[var(--color-surface)]">
                    <div className="h-full" style={{ width: `${improvingPct}%`, background: "var(--color-accent)" }} title={`${t.improving} improving`} />
                    <div className="h-full" style={{ width: `${stablePct}%`, background: "var(--color-muted)" }} title={`${t.stable} stable`} />
                    <div className="h-full" style={{ width: `${decliningPct}%`, background: "#f87171" }} title={`${t.declining} declining`} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="text-[var(--color-muted)]">Δ media classifica</span>
                    <span className="num font-medium" style={{ color: avgColor }}>
                      {`${avgSign}${Math.abs(t.avgDelta).toFixed(1)}`} pt
                    </span>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[10px] text-[var(--color-muted)]">
                  Aggiungi la classifica degli atleti dal loro profilo per popolare questa scheda.
                </p>
              )}
            </div>

            {/* Coach login — admin creates a sign-in account for the coach
                so they can log in to their scoped workspace. Empty state
                shows a "Create login" CTA, populated state shows the email
                plus a "Reset password" link. */}
            <CoachLoginButton
              coachId={c.id}
              coachName={c.name}
              existingEmail={c.loginEmail}
              presetEmail={c.email}
            />

            <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
              <Modal label="Modifica" title="Modifica maestro" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
                <CoachForm initial={{ id: c.id, name: c.name, email: c.email, phone: c.phone, role: c.role, specialization: c.specialization, notes: c.notes, active: c.active, cost: c.cost }} />
              </Modal>
              <ArchiveCoachButton id={c.id} active={c.active} />
              <DeleteButton kind="coach" id={c.id} label="Delete" />
            </div>
          </div>
          );
        })}
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

// Same shell as Stat but takes a pre-formatted string (e.g. money). Keeps
// the trio of mini-stats visually aligned even when the third number is
// large (e.g. "NOK 480,000") — the font shrinks slightly so it still fits.
function StatMoney({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-2 p-2">
      <div className="num text-sm font-bold leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

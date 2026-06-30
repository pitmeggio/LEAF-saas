"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  createCoach, updateCoach, archiveCoach, deleteCoach,
  createGroup, updateGroup, deleteGroup,
  createPackage, updatePackage, deletePackage,
  createAthlete, updateAthlete, deleteEnrollment,
  updateApplication, deleteApplication,
  type Result,
} from "@/app/entity-actions";
import { confirmAcceptance } from "@/app/ops-actions";
import { createExpense, updateExpense, addGroupExpense } from "@/app/expense-actions";
import type { CoachInput, GroupInput, PackageInput, ManualAthleteInput, ExpenseInput } from "@/lib/validation";
import { COUNTRY, DISCIPLINE_LABEL, fmtMoney } from "@/lib/domain";
import { buildPaymentSchedule, REQUIRED_DOC_TYPES, DOC_LABEL } from "@/lib/enrollmentLogic";
import {
  ACCOUNT_CODES, PAYMENT_METHODS, vatRatesForCountry, vatLabel, categoryDefaults,
  defaultMileageRateCents, mileageAmount, splitVat,
} from "@/lib/accounting";

type Opt = { id: string; name: string };

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-xs text-[var(--color-muted)]";

const ModalCtx = createContext<() => void>(() => {});
function useModalClose() { return useContext(ModalCtx); }

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className={lbl}>{label}</label>{children}</div>;
}

function useSubmit() {
  const close = useModalClose();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const submit = (fn: () => Promise<Result>) =>
    start(async () => { const r = await fn(); if (r.ok) { close(); router.refresh(); } else setError(r.error ?? "Something went wrong"); });
  return { pending, error, submit };
}

// children are React elements (serializable across the RSC boundary); `close` is provided via context.
export function Modal({ label, title, className, children }: { label: ReactNode; title: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Lock background scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  // Rendered via a portal to document.body — escapes any ancestor with backdrop-filter/
  // transform (e.g. the sticky PageHeader), which would otherwise become the containing
  // block for `position: fixed` and trap the overlay inside the header.
  const overlay = (
    // Overlay scrolls (not the flex item) so the modal top is always reachable on short screens.
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm" onClick={close}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="card my-8 flex max-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[14px] border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
            <h3 className="text-base font-semibold">{title}</h3>
            <button onClick={close} aria-label="Close" className="text-lg text-[var(--color-muted)] hover:text-[var(--color-fg)]">✕</button>
          </div>
          <div className="overflow-y-auto px-6 py-5">
            <ModalCtx.Provider value={close}>{children}</ModalCtx.Provider>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && typeof document !== "undefined" && createPortal(overlay, document.body)}
    </>
  );
}

function Footer({ pending, error }: { pending: boolean; error: string | null }) {
  return (
    <>
      {error && <p className="mt-3 text-sm text-[#f87171]">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}

export function DeleteButton({ kind, id, label = "Elimina", className }: { kind: "coach" | "group" | "package" | "enrollment" | "application"; id: string; label?: string; className?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const fns = { coach: deleteCoach, group: deleteGroup, package: deletePackage, enrollment: deleteEnrollment, application: deleteApplication };
  return (
    <button
      disabled={pending}
      onClick={() => { if (confirm(`${label}? This cannot be undone.`)) start(async () => { await fns[kind](id); router.refresh(); }); }}
      className={className ?? "rounded-lg border border-[#f8717140] px-3 py-1.5 text-xs font-medium text-[#f87171] hover:bg-[#f8717112] disabled:opacity-50"}
    >
      {pending ? "…" : label}
    </button>
  );
}

// ── Coach ──
export function CoachForm({ initial }: { initial?: { id: string; name: string; email: string | null; phone: string | null; role: string; specialization: string | null; notes: string | null; active: boolean; cost?: number | null } }) {
  const [f, set] = useState({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    role: initial?.role ?? "coach",
    specialization: initial?.specialization ?? "",
    notes: initial?.notes ?? "",
    active: initial?.active ?? true,
    // Season salary in academy currency major units. Sent to budget
    // forecast as committed-spend on every team the coach leads.
    cost: initial?.cost ?? 0,
  });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const payload = { ...f, cost: Number(f.cost) || 0 } as unknown as CoachInput;
        submit(() => (initial ? updateCoach(initial.id, payload) : createCoach(payload)));
      }}
      className="space-y-3"
    >
      <Field label="Name *"><input className={inp} value={f.name} onChange={(e) => upd("name", e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input className={inp} value={f.email} onChange={(e) => upd("email", e.target.value)} /></Field>
        <Field label="Phone"><input className={inp} value={f.phone} onChange={(e) => upd("phone", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <select className={inp} value={f.role} onChange={(e) => upd("role", e.target.value)}>
            <option value="head_coach">Head coach</option>
            <option value="assistant_coach">Assistant coach</option>
            <option value="coach">Coach</option>
            <option value="physio">Physio</option>
            <option value="s_and_c">Strength &amp; conditioning</option>
          </select>
        </Field>
        <Field label="Specialization"><input className={inp} value={f.specialization} onChange={(e) => upd("specialization", e.target.value)} /></Field>
      </div>
      <Field label="Season salary (academy currency)">
        <input
          type="number"
          min={0}
          className={inp}
          value={f.cost}
          onChange={(e) => upd("cost", e.target.value)}
          placeholder="e.g. 480000 for head coach 40k × 12 months"
        />
      </Field>
      <Field label="Notes"><textarea className={`${inp} resize-none`} rows={2} value={f.notes} onChange={(e) => upd("notes", e.target.value)} /></Field>
      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Group ──
type GroupInitial = { id: string; name: string; season: string; coachId: string | null; capacity: number; notes: string | null; active: boolean; budget?: number | null; budgetHardStop?: boolean; pointsMin?: number | null; pointsMax?: number | null; ageMin?: number | null; ageMax?: number | null; level?: string | null; discipline?: string | null };

export function GroupForm({ coaches, initial, currency = "EUR" }: { coaches: Opt[]; initial?: GroupInitial; currency?: string }) {
  const [f, set] = useState({
    name: initial?.name ?? "", season: initial?.season ?? "2026/27", coachId: initial?.coachId ?? "",
    capacity: initial?.capacity ?? 12, notes: initial?.notes ?? "", active: initial?.active ?? true, sport: "ski",
    budget: initial?.budget ?? "", budgetHardStop: initial?.budgetHardStop ?? false,
    pointsMin: initial?.pointsMin ?? "", pointsMax: initial?.pointsMax ?? "",
    ageMin: initial?.ageMin ?? "", ageMax: initial?.ageMax ?? "",
    level: initial?.level ?? "", discipline: initial?.discipline ?? "",
  });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  const num = (v: string | number) => (v === "" || v == null ? null : Number(v));
  const payload = (): GroupInput => ({
    name: f.name, season: f.season, sport: f.sport, capacity: Number(f.capacity), notes: f.notes || undefined, active: f.active,
    coachId: f.coachId || undefined, budget: num(f.budget), budgetHardStop: f.budgetHardStop,
    pointsMin: num(f.pointsMin), pointsMax: num(f.pointsMax), ageMin: num(f.ageMin), ageMax: num(f.ageMax),
    level: f.level || null, discipline: f.discipline || null,
  } as GroupInput);
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => initial ? updateGroup(initial.id, payload()) : createGroup(payload())); }} className="space-y-3">
      <Field label="Name *"><input className={inp} value={f.name} onChange={(e) => upd("name", e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Season"><input className={inp} value={f.season} onChange={(e) => upd("season", e.target.value)} /></Field>
        <Field label="Capacity"><input type="number" min={1} className={inp} value={f.capacity} onChange={(e) => upd("capacity", Number(e.target.value))} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Season budget (${currency})`}><input type="number" min={0} className={inp} value={f.budget} placeholder="e.g. 90000" onChange={(e) => upd("budget", e.target.value)} /></Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={f.budgetHardStop} onChange={(e) => upd("budgetHardStop", e.target.checked)} className="accent-[var(--color-accent)]" />
          <span>Block over-budget approvals</span>
        </label>
      </div>
      <Field label="Coach">
        <select className={inp} value={f.coachId} onChange={(e) => upd("coachId", e.target.value)}>
          <option value="">Unassigned</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-muted)]">
          <span className="flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
          Smart assignment rules <span className="font-normal">· drives suggested groups</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Points min"><input type="number" className={inp} value={f.pointsMin} onChange={(e) => upd("pointsMin", e.target.value)} placeholder="any" /></Field>
          <Field label="Points max"><input type="number" className={inp} value={f.pointsMax} onChange={(e) => upd("pointsMax", e.target.value)} placeholder="any" /></Field>
          <Field label="Age min"><input type="number" className={inp} value={f.ageMin} onChange={(e) => upd("ageMin", e.target.value)} placeholder="any" /></Field>
          <Field label="Age max"><input type="number" className={inp} value={f.ageMax} onChange={(e) => upd("ageMax", e.target.value)} placeholder="any" /></Field>
          <Field label="Level">
            <select className={inp} value={f.level} onChange={(e) => upd("level", e.target.value)}>
              <option value="">Any</option><option value="development">Development</option><option value="competitive">Competitive</option><option value="elite">Elite</option>
            </select>
          </Field>
          <Field label="Discipline (optional)"><input className={inp} value={f.discipline} onChange={(e) => upd("discipline", e.target.value)} placeholder="any" /></Field>
        </div>
      </div>

      <Field label="Notes"><textarea className={`${inp} resize-none`} rows={2} value={f.notes} onChange={(e) => upd("notes", e.target.value)} /></Field>
      <Footer pending={pending} error={error} />
    </form>
  );
}

type PackageInitial = { id: string; name: string; description: string | null; price: number | null; currency: string; period: string; billingFreq: string; features: string | null; accommodation: boolean; transport: boolean; coaching: boolean; raceSupport: boolean; maxAthletes: number | null; active: boolean };

// ── Package ──
export function PackageForm({ initial }: { initial?: PackageInitial }) {
  const [f, set] = useState({
    name: initial?.name ?? "", description: initial?.description ?? "", price: initial?.price ?? 0, currency: initial?.currency ?? "EUR",
    period: initial?.period ?? "season", billingFreq: initial?.billingFreq ?? "seasonal", features: initial?.features ?? "",
    accommodation: initial?.accommodation ?? false, transport: initial?.transport ?? false, coaching: initial?.coaching ?? true, raceSupport: initial?.raceSupport ?? false,
    maxAthletes: initial?.maxAthletes ?? 20, active: initial?.active ?? true,
  });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  const payload = (): PackageInput => ({ ...f, price: Number(f.price) || null, maxAthletes: Number(f.maxAthletes) || null }) as PackageInput;
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => initial ? updatePackage(initial.id, payload()) : createPackage(payload())); }} className="space-y-3">
      <Field label="Name *"><input className={inp} value={f.name} onChange={(e) => upd("name", e.target.value)} required /></Field>
      <Field label="Description"><textarea className={`${inp} resize-none`} rows={2} value={f.description} onChange={(e) => upd("description", e.target.value)} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Price"><input type="number" min={0} className={inp} value={f.price} onChange={(e) => upd("price", e.target.value)} /></Field>
        <Field label="Period"><select className={inp} value={f.period} onChange={(e) => upd("period", e.target.value)}><option value="season">Season</option><option value="camp">Camp</option><option value="month">Month</option></select></Field>
        <Field label="Billing"><select className={inp} value={f.billingFreq} onChange={(e) => upd("billingFreq", e.target.value)}><option value="seasonal">Seasonal</option><option value="monthly">Monthly</option><option value="one_time">One-time</option></select></Field>
      </div>
      <Field label="Max athletes"><input type="number" min={1} className={inp} value={f.maxAthletes} onChange={(e) => upd("maxAthletes", e.target.value)} /></Field>
      <div className="flex flex-wrap gap-3 text-sm">
        {(["coaching", "raceSupport", "accommodation", "transport"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1.5 capitalize"><input type="checkbox" className="accent-[var(--color-accent)]" checked={f[k]} onChange={(e) => upd(k, e.target.checked)} />{k === "raceSupport" ? "Race support" : k}</label>
        ))}
      </div>
      <Field label="Features (one per line)"><textarea className={`${inp} resize-none`} rows={3} value={f.features} onChange={(e) => upd("features", e.target.value)} /></Field>
      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Manual athlete ──
export function AthleteForm({ groups, coaches, packages }: { groups: Opt[]; coaches: Opt[]; packages: Opt[] }) {
  const [f, set] = useState({ firstName: "", lastName: "", email: "", phone: "", dob: "", nationality: "", gender: "", discipline: "", sport: "ski", level: "", groupId: "", coachId: "", packageId: "" });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => createAthlete({ ...f, gender: (f.gender || undefined) as "M" | "F" | undefined, level: f.level || undefined, groupId: f.groupId || undefined, coachId: f.coachId || undefined, packageId: f.packageId || undefined } as ManualAthleteInput)); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name *"><input className={inp} value={f.firstName} onChange={(e) => upd("firstName", e.target.value)} required /></Field>
        <Field label="Last name *"><input className={inp} value={f.lastName} onChange={(e) => upd("lastName", e.target.value)} required /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input className={inp} value={f.email} onChange={(e) => upd("email", e.target.value)} /></Field>
        <Field label="Phone"><input className={inp} value={f.phone} onChange={(e) => upd("phone", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of birth *"><input type="date" className={inp} value={f.dob} onChange={(e) => upd("dob", e.target.value)} required /></Field>
        <Field label="Nationality">
          <select className={inp} value={f.nationality} onChange={(e) => upd("nationality", e.target.value)} required><option value="">Select…</option>{Object.entries(COUNTRY).map(([c, v]) => <option key={c} value={c}>{v.flag} {v.name}</option>)}</select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Discipline">
          <select className={inp} value={f.discipline} onChange={(e) => upd("discipline", e.target.value)} required><option value="">Select…</option>{Object.entries(DISCIPLINE_LABEL).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
        </Field>
        <Field label="Level"><select className={inp} value={f.level} onChange={(e) => upd("level", e.target.value)}><option value="">—</option><option value="development">Development</option><option value="competitive">Competitive</option><option value="elite">Elite</option></select></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Group"><select className={inp} value={f.groupId} onChange={(e) => upd("groupId", e.target.value)}><option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        <Field label="Coach"><select className={inp} value={f.coachId} onChange={(e) => upd("coachId", e.target.value)}><option value="">—</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Package"><select className={inp} value={f.packageId} onChange={(e) => upd("packageId", e.target.value)}><option value="">—</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      </div>
      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Athlete identity edit ──
export function AthleteEditForm({ athlete }: { athlete: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; nationality: string; discipline: string; emergencyContact: string | null; guardianName: string | null; guardianContact: string | null; sport?: string; dominantHand?: string | null; playingStyle?: string | null; technicalLevel?: number | null; tacticalLevel?: number | null; physicalLevel?: number | null; mentalLevel?: number | null; developmentGoals?: string | null; seasonGoals?: string | null } }) {
  const [f, set] = useState({
    firstName: athlete.firstName, lastName: athlete.lastName, email: athlete.email ?? "", phone: athlete.phone ?? "",
    nationality: athlete.nationality, discipline: athlete.discipline,
    emergencyContact: athlete.emergencyContact ?? "", guardianName: athlete.guardianName ?? "", guardianContact: athlete.guardianContact ?? "",
    // Tennis fields — stay empty for ski athletes and are simply ignored.
    dominantHand: athlete.dominantHand ?? "",
    playingStyle: athlete.playingStyle ?? "",
    technicalLevel: athlete.technicalLevel ?? "",
    tacticalLevel: athlete.tacticalLevel ?? "",
    physicalLevel: athlete.physicalLevel ?? "",
    mentalLevel: athlete.mentalLevel ?? "",
    developmentGoals: athlete.developmentGoals ?? "",
    seasonGoals: athlete.seasonGoals ?? "",
  });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  const isTennis = (athlete.sport ?? "ski") === "tennis";
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => updateAthlete({
      athleteId: athlete.id,
      ...f,
      // Coerce empty-string back to undefined so the schema's optional/null
      // transforms kick in cleanly.
      dominantHand: f.dominantHand || undefined,
      playingStyle: f.playingStyle || undefined,
      technicalLevel: f.technicalLevel === "" ? undefined : Number(f.technicalLevel),
      tacticalLevel: f.tacticalLevel === "" ? undefined : Number(f.tacticalLevel),
      physicalLevel: f.physicalLevel === "" ? undefined : Number(f.physicalLevel),
      mentalLevel: f.mentalLevel === "" ? undefined : Number(f.mentalLevel),
      developmentGoals: f.developmentGoals || undefined,
      seasonGoals: f.seasonGoals || undefined,
    })); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name *"><input className={inp} value={f.firstName} onChange={(e) => upd("firstName", e.target.value)} required /></Field>
        <Field label="Last name *"><input className={inp} value={f.lastName} onChange={(e) => upd("lastName", e.target.value)} required /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input className={inp} value={f.email} onChange={(e) => upd("email", e.target.value)} /></Field>
        <Field label="Phone"><input className={inp} value={f.phone} onChange={(e) => upd("phone", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nationality"><select className={inp} value={f.nationality} onChange={(e) => upd("nationality", e.target.value)}>{Object.entries(COUNTRY).map(([c, v]) => <option key={c} value={c}>{v.flag} {v.name}</option>)}</select></Field>
        <Field label="Discipline"><select className={inp} value={f.discipline} onChange={(e) => upd("discipline", e.target.value)}>{Object.entries(DISCIPLINE_LABEL).map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select></Field>
      </div>
      <Field label="Emergency contact"><input className={inp} value={f.emergencyContact} onChange={(e) => upd("emergencyContact", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Guardian"><input className={inp} value={f.guardianName} onChange={(e) => upd("guardianName", e.target.value)} /></Field>
        <Field label="Guardian contact"><input className={inp} value={f.guardianContact} onChange={(e) => upd("guardianContact", e.target.value)} /></Field>
      </div>

      {isTennis && (
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-fg)]">
            Tennis profile
            <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[9px] uppercase tracking-wide text-[var(--color-muted)]">coach-curated</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dominant hand">
              <select className={inp} value={f.dominantHand} onChange={(e) => upd("dominantHand", e.target.value)}>
                <option value="">—</option>
                <option value="right">Right</option>
                <option value="left">Left</option>
                <option value="ambidextrous">Ambidextrous</option>
              </select>
            </Field>
            <Field label="Playing style">
              <input className={inp} placeholder="e.g. aggressive baseliner" value={f.playingStyle} onChange={(e) => upd("playingStyle", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Technical 1–10"><input type="number" min={1} max={10} className={inp} value={f.technicalLevel} onChange={(e) => upd("technicalLevel", e.target.value)} /></Field>
            <Field label="Tactical 1–10"><input type="number" min={1} max={10} className={inp} value={f.tacticalLevel} onChange={(e) => upd("tacticalLevel", e.target.value)} /></Field>
            <Field label="Physical 1–10"><input type="number" min={1} max={10} className={inp} value={f.physicalLevel} onChange={(e) => upd("physicalLevel", e.target.value)} /></Field>
            <Field label="Mental 1–10"><input type="number" min={1} max={10} className={inp} value={f.mentalLevel} onChange={(e) => upd("mentalLevel", e.target.value)} /></Field>
          </div>
          <Field label="Development goals">
            <textarea className={inp} rows={3} value={f.developmentGoals} onChange={(e) => upd("developmentGoals", e.target.value)} />
          </Field>
        </div>
      )}

      {/* Season goals — universal across sports. The narrative intent that
          drives the athlete's season. AI coach notes align to it (Phase 2). */}
      <Field label="Season goals">
        <textarea
          className={inp}
          rows={3}
          placeholder="e.g. Drop average FIS points below 25 in GS · Finish top-5 at regional championships · Improve SL consistency"
          value={f.seasonGoals}
          onChange={(e) => upd("seasonGoals", e.target.value)}
        />
      </Field>

      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Expense (coach) ──
const EXPENSE_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "NOK", "SEK", "DKK", "CAD", "AUD", "JPY"];
// Cost lines aligned to the academy's budget model (Marius's Dev Team budget).
const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "coaching", label: "Coaching" },
  { value: "housing", label: "Housing" },
  { value: "accommodation", label: "Accommodation" },
  { value: "lift_pass", label: "Lift passes" },
  { value: "fuel", label: "Fuel" },
  { value: "transport", label: "Transport / cars" },
  { value: "equipment", label: "Equipment / clothing" },
  { value: "race_cost", label: "Race cost" },
  { value: "sport_ops", label: "Sport / operations" },
  { value: "other", label: "Other" },
];
export function ExpenseForm({ groups, initial, currency = "EUR", country }: { groups: Opt[]; initial?: { id: string; title: string; amount: number; category: string; groupId: string | null; notes: string | null; currency?: string; expenseDate?: string | null; receiptUrl?: string | null; kind?: string | null; supplier?: string | null; accountCode?: string | null; vatRate?: number | null; paymentMethod?: string | null; distanceKm?: number | null; ratePerKmCents?: number | null; fromPlace?: string | null; toPlace?: string | null }; currency?: string; country?: string | null }) {
  const cat0 = initial?.category ?? "hotel";
  const def0 = categoryDefaults(cat0, country);
  const [f, set] = useState({
    kind: initial?.kind ?? "expense",
    title: initial?.title ?? "", amount: initial?.amount ?? 0, category: cat0,
    groupId: initial?.groupId ?? "", notes: initial?.notes ?? "", currency: initial?.currency ?? currency,
    expenseDate: initial?.expenseDate ?? "", receiptUrl: initial?.receiptUrl ?? "",
    supplier: initial?.supplier ?? "", accountCode: initial?.accountCode ?? def0.account,
    vatRate: initial?.vatRate ?? def0.vat, paymentMethod: initial?.paymentMethod ?? "private_outlay",
    distanceKm: initial?.distanceKm ?? 0, ratePerKmCents: initial?.ratePerKmCents ?? defaultMileageRateCents(country),
    fromPlace: initial?.fromPlace ?? "", toPlace: initial?.toPlace ?? "",
  });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  // Picking a category pre-fills the accounting account + VAT (PowerOffice-style).
  const onCategory = (cat: string) => { const d = categoryDefaults(cat, country); set((s) => ({ ...s, category: cat, accountCode: d.account, vatRate: d.vat })); };

  const isMileage = f.kind === "mileage";
  const mileageGross = mileageAmount(Number(f.distanceKm) || 0, Number(f.ratePerKmCents) || 0);
  const gross = isMileage ? mileageGross : (Number(f.amount) || 0);
  const { net, vat } = splitVat(gross, isMileage ? 0 : Number(f.vatRate));
  const vatRates = vatRatesForCountry(country);
  const vlabel = vatLabel(country);

  const payload = (): ExpenseInput => ({
    kind: f.kind, title: f.title, amount: gross, category: isMileage ? "transport" : f.category,
    groupId: f.groupId || undefined, notes: f.notes || undefined, currency: f.currency,
    expenseDate: f.expenseDate || undefined, receiptUrl: f.receiptUrl || undefined,
    supplier: f.supplier || undefined, accountCode: f.accountCode || undefined,
    vatRate: isMileage ? 0 : Number(f.vatRate), paymentMethod: f.paymentMethod || undefined,
    distanceKm: isMileage ? Number(f.distanceKm) || 0 : undefined,
    ratePerKmCents: isMileage ? Number(f.ratePerKmCents) || 0 : undefined,
    fromPlace: isMileage ? f.fromPlace || undefined : undefined,
    toPlace: isMileage ? f.toPlace || undefined : undefined,
  }) as unknown as ExpenseInput;

  const currencyOptions = EXPENSE_CURRENCIES.includes(f.currency) ? EXPENSE_CURRENCIES : [f.currency, ...EXPENSE_CURRENCIES];
  const tab = (k: string, label: string) => (
    <button type="button" onClick={() => upd("kind", k)} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${f.kind === k ? "bg-[var(--color-accent)] text-[#0a0c10]" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}>{label}</button>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => initial ? updateExpense(initial.id, payload()) : createExpense(payload())); }} className="space-y-3">
      <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
        {tab("expense", "💳 Expense")}{tab("mileage", "🚗 Mileage")}
      </div>

      {isMileage ? (
        <>
          <Field label="Purpose *"><input className={inp} value={f.title} placeholder="e.g. Drive to Hafjell race" onChange={(e) => upd("title", e.target.value)} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><input className={inp} value={f.fromPlace} placeholder="Trysil" onChange={(e) => upd("fromPlace", e.target.value)} /></Field>
            <Field label="To"><input className={inp} value={f.toPlace} placeholder="Hafjell" onChange={(e) => upd("toPlace", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distance (km) *"><input type="number" min={1} className={inp} value={f.distanceKm} onChange={(e) => upd("distanceKm", e.target.value)} required /></Field>
            <Field label={`Rate (${f.currency}/km)`}><input type="number" min={0} step="0.01" className={inp} value={(Number(f.ratePerKmCents) / 100).toString()} onChange={(e) => upd("ratePerKmCents", Math.round((Number(e.target.value) || 0) * 100))} /></Field>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
            <span className="text-[var(--color-muted)]">Reimbursement</span> · <span className="num font-semibold">{f.distanceKm || 0} km × {(Number(f.ratePerKmCents) / 100).toFixed(2)} = {fmtMoney(mileageGross, f.currency)}</span> <span className="text-[10px] text-[var(--color-muted)]">(VAT-free)</span>
          </div>
        </>
      ) : (
        <>
          <Field label="Title *"><input className={inp} value={f.title} onChange={(e) => upd("title", e.target.value)} required /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Gross amount *"><input type="number" min={1} className={inp} value={f.amount} onChange={(e) => upd("amount", e.target.value)} required /></Field>
            <Field label="Currency"><select className={inp} value={f.currency} onChange={(e) => upd("currency", e.target.value)}>{currencyOptions.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field label="Category"><select className={inp} value={f.category} onChange={(e) => onCategory(e.target.value)}>{EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier"><input className={inp} value={f.supplier} placeholder="Vendor name" onChange={(e) => upd("supplier", e.target.value)} /></Field>
            <Field label="Payment"><select className={inp} value={f.paymentMethod} onChange={(e) => upd("paymentMethod", e.target.value)}>{PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Account (kontonummer)"><select className={inp} value={f.accountCode} onChange={(e) => upd("accountCode", e.target.value)}>{ACCOUNT_CODES.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.label}</option>)}</select></Field>
            <Field label={`${vlabel} rate`}><select className={inp} value={String(f.vatRate)} onChange={(e) => upd("vatRate", Number(e.target.value))}>{vatRates.map((r) => <option key={r} value={r}>{r}%</option>)}</select></Field>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-muted)]">
            Net <span className="num font-semibold text-[var(--color-fg)]">{fmtMoney(net, f.currency)}</span> · {vlabel} ({Number(f.vatRate)}%) <span className="num font-semibold text-[var(--color-fg)]">{fmtMoney(vat, f.currency)}</span> · Gross <span className="num font-semibold text-[var(--color-fg)]">{fmtMoney(gross, f.currency)}</span>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inp} value={f.expenseDate} onChange={(e) => upd("expenseDate", e.target.value)} /></Field>
        <Field label="Group"><select className={inp} value={f.groupId} onChange={(e) => upd("groupId", e.target.value)}><option value="">No group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
      </div>
      {!isMileage && <Field label="Receipt link (optional)"><input type="url" className={inp} value={f.receiptUrl} placeholder="https://… external link, if any" onChange={(e) => upd("receiptUrl", e.target.value)} /></Field>}
      <Field label="Description"><textarea className={`${inp} resize-none`} rows={2} value={f.notes} onChange={(e) => upd("notes", e.target.value)} /></Field>
      <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
        📷 Save it, then snap or upload the <span className="font-medium">receipt photo</span> from the Receipts column — stored in LEAF, exported to your accountant. No PowerOffice needed.
      </p>
      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Admin: add a budget line item directly to a group (auto-approved) ──
export function GroupExpenseForm({ groupId, currency = "EUR" }: { groupId: string; currency?: string }) {
  const [f, set] = useState({ title: "", amount: 0, category: "other", expenseDate: "" });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => addGroupExpense({ groupId, title: f.title, amount: Number(f.amount) || 0, category: f.category, expenseDate: f.expenseDate || undefined })); }} className="space-y-3">
      <p className="text-xs text-[var(--color-muted)]">Adds an approved cost to this group&apos;s budget — remaining updates instantly.</p>
      <Field label="What *"><input className={inp} value={f.title} placeholder="e.g. Cars, Lift passes…" onChange={(e) => upd("title", e.target.value)} required /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={`Amount (${currency}) *`}><input type="number" min={1} className={inp} value={f.amount} onChange={(e) => upd("amount", e.target.value)} required /></Field>
        <Field label="Category"><select className={inp} value={f.category} onChange={(e) => upd("category", e.target.value)}>{EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
        <Field label="Date"><input type="date" className={inp} value={f.expenseDate} onChange={(e) => upd("expenseDate", e.target.value)} /></Field>
      </div>
      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Acceptance confirmation (manual review before enrollment) ──
type PkgOpt = { id: string; name: string; price: number | null; currency: string; billingFreq: string };
export function AcceptForm({
  application, athleteName, academyName, packages, groups, coaches, recommendedGroupId,
}: {
  application: { id: string; packageId: string | null };
  athleteName: string;
  academyName: string;
  packages: PkgOpt[];
  groups: Opt[];
  coaches: Opt[];
  recommendedGroupId?: string | null;
}) {
  const [packageId, setPackageId] = useState(application.packageId ?? "");
  const [groupId, setGroupId] = useState(recommendedGroupId ?? "");
  const [coachId, setCoachId] = useState("");
  const { pending, error, submit } = useSubmit();

  const pkg = packages.find((p) => p.id === packageId);
  const schedule = pkg && pkg.price ? buildPaymentSchedule({ price: pkg.price, currency: pkg.currency, billingFreq: pkg.billingFreq, joinDate: new Date() }) : [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-muted)]">Academy</span><span>{academyName}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-muted)]">Athlete</span><span className="font-medium">{athleteName}</span></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Package"><select className={inp} value={packageId} onChange={(e) => setPackageId(e.target.value)}><option value="">None</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Group"><select className={inp} value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">Assign later</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        <Field label="Coach"><select className={inp} value={coachId} onChange={(e) => setCoachId(e.target.value)}><option value="">Assign later</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>

      <div>
        <div className="mb-1 text-xs text-[var(--color-muted)]">Payment schedule {pkg?.price ? `· ${fmtMoney(pkg.price, pkg.currency)} total` : ""}</div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm">
          {schedule.length === 0 && <span className="text-[var(--color-muted)]">No package selected — no schedule.</span>}
          {schedule.map((s, i) => (
            <div key={i} className="flex justify-between"><span className="text-[var(--color-muted)]">{s.label}</span><span className="num">{fmtMoney(s.amount, s.currency)}</span></div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs text-[var(--color-muted)]">Required documents (auto-created)</div>
        <div className="flex flex-wrap gap-1.5">
          {REQUIRED_DOC_TYPES.map((t) => <span key={t} className="rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">{DOC_LABEL[t]}</span>)}
        </div>
      </div>

      {error && <p className="text-sm text-[#f87171]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={() => submit(() => confirmAcceptance(application.id, { packageId: packageId || null, groupId: groupId || null, coachId: coachId || null }))} disabled={pending}
          className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          {pending ? "Creating…" : "Confirm & create enrollment"}
        </button>
      </div>
    </div>
  );
}

// ── Application edit ──
export function ApplicationEditForm({ application, programs, packages }: { application: { id: string; programId: string | null; packageId: string | null; score: number | null; message: string | null }; programs: Opt[]; packages: Opt[] }) {
  const [f, set] = useState({ programId: application.programId ?? "", packageId: application.packageId ?? "", score: application.score ?? 0, message: application.message ?? "" });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => updateApplication({ applicationId: application.id, programId: f.programId || undefined, packageId: f.packageId || undefined, score: Number(f.score) || null, message: f.message || undefined })); }} className="space-y-3">
      <Field label="Program"><select className={inp} value={f.programId} onChange={(e) => upd("programId", e.target.value)}><option value="">—</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Package"><select className={inp} value={f.packageId} onChange={(e) => upd("packageId", e.target.value)}><option value="">—</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Fit score (0–100)"><input type="number" min={0} max={100} className={inp} value={f.score} onChange={(e) => upd("score", e.target.value)} /></Field>
      <Field label="Message"><textarea className={`${inp} resize-none`} rows={3} value={f.message} onChange={(e) => upd("message", e.target.value)} /></Field>
      <Footer pending={pending} error={error} />
    </form>
  );
}

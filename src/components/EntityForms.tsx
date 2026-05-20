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
import { createExpense, updateExpense } from "@/app/expense-actions";
import type { CoachInput, GroupInput, PackageInput, ManualAthleteInput, ExpenseInput } from "@/lib/validation";
import { COUNTRY, DISCIPLINE_LABEL, fmtMoney } from "@/lib/domain";
import { buildPaymentSchedule, REQUIRED_DOC_TYPES, DOC_LABEL } from "@/lib/enrollmentLogic";

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

export function DeleteButton({ kind, id, label = "Delete", className }: { kind: "coach" | "group" | "package" | "enrollment" | "application"; id: string; label?: string; className?: string }) {
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
export function CoachForm({ initial }: { initial?: { id: string; name: string; email: string | null; phone: string | null; role: string; specialization: string | null; notes: string | null; active: boolean } }) {
  const [f, set] = useState({ name: initial?.name ?? "", email: initial?.email ?? "", phone: initial?.phone ?? "", role: initial?.role ?? "coach", specialization: initial?.specialization ?? "", notes: initial?.notes ?? "", active: initial?.active ?? true });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => initial ? updateCoach(initial.id, f as CoachInput) : createCoach(f as CoachInput)); }} className="space-y-3">
      <Field label="Name *"><input className={inp} value={f.name} onChange={(e) => upd("name", e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input className={inp} value={f.email} onChange={(e) => upd("email", e.target.value)} /></Field>
        <Field label="Phone"><input className={inp} value={f.phone} onChange={(e) => upd("phone", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <select className={inp} value={f.role} onChange={(e) => upd("role", e.target.value)}>
            <option value="head_coach">Head coach</option><option value="coach">Coach</option><option value="physio">Physio</option><option value="s_and_c">Strength & conditioning</option>
          </select>
        </Field>
        <Field label="Specialization"><input className={inp} value={f.specialization} onChange={(e) => upd("specialization", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className={`${inp} resize-none`} rows={2} value={f.notes} onChange={(e) => upd("notes", e.target.value)} /></Field>
      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Group ──
export function GroupForm({ coaches, initial }: { coaches: Opt[]; initial?: { id: string; name: string; season: string; coachId: string | null; capacity: number; notes: string | null; active: boolean } }) {
  const [f, set] = useState({ name: initial?.name ?? "", season: initial?.season ?? "2026/27", coachId: initial?.coachId ?? "", capacity: initial?.capacity ?? 12, notes: initial?.notes ?? "", active: initial?.active ?? true, sport: "ski" });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => initial ? updateGroup(initial.id, { ...f, coachId: f.coachId || undefined } as GroupInput) : createGroup({ ...f, coachId: f.coachId || undefined } as GroupInput)); }} className="space-y-3">
      <Field label="Name *"><input className={inp} value={f.name} onChange={(e) => upd("name", e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Season"><input className={inp} value={f.season} onChange={(e) => upd("season", e.target.value)} /></Field>
        <Field label="Capacity"><input type="number" min={1} className={inp} value={f.capacity} onChange={(e) => upd("capacity", Number(e.target.value))} /></Field>
      </div>
      <Field label="Coach">
        <select className={inp} value={f.coachId} onChange={(e) => upd("coachId", e.target.value)}>
          <option value="">Unassigned</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
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
export function AthleteEditForm({ athlete }: { athlete: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; nationality: string; discipline: string; emergencyContact: string | null; guardianName: string | null; guardianContact: string | null } }) {
  const [f, set] = useState({ firstName: athlete.firstName, lastName: athlete.lastName, email: athlete.email ?? "", phone: athlete.phone ?? "", nationality: athlete.nationality, discipline: athlete.discipline, emergencyContact: athlete.emergencyContact ?? "", guardianName: athlete.guardianName ?? "", guardianContact: athlete.guardianContact ?? "" });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => updateAthlete({ athleteId: athlete.id, ...f })); }} className="space-y-3">
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
      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Expense (coach) ──
export function ExpenseForm({ groups, initial }: { groups: Opt[]; initial?: { id: string; title: string; amount: number; category: string; groupId: string | null; notes: string | null } }) {
  const [f, set] = useState({ title: initial?.title ?? "", amount: initial?.amount ?? 0, category: initial?.category ?? "travel", groupId: initial?.groupId ?? "", notes: initial?.notes ?? "" });
  const { pending, error, submit } = useSubmit();
  const upd = (k: string, v: unknown) => set((s) => ({ ...s, [k]: v }));
  const payload = (): ExpenseInput => ({ title: f.title, amount: Number(f.amount) || 0, category: f.category as "travel" | "equipment" | "accommodation" | "other", groupId: f.groupId || undefined, notes: f.notes || undefined }) as ExpenseInput;
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(() => initial ? updateExpense(initial.id, payload()) : createExpense(payload())); }} className="space-y-3">
      <Field label="Title *"><input className={inp} value={f.title} onChange={(e) => upd("title", e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (EUR) *"><input type="number" min={1} className={inp} value={f.amount} onChange={(e) => upd("amount", e.target.value)} required /></Field>
        <Field label="Category"><select className={inp} value={f.category} onChange={(e) => upd("category", e.target.value)}><option value="travel">Travel</option><option value="equipment">Equipment</option><option value="accommodation">Accommodation</option><option value="other">Other</option></select></Field>
      </div>
      <Field label="Group"><select className={inp} value={f.groupId} onChange={(e) => upd("groupId", e.target.value)}><option value="">No group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
      <Field label="Notes"><textarea className={`${inp} resize-none`} rows={2} value={f.notes} onChange={(e) => upd("notes", e.target.value)} /></Field>
      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Acceptance confirmation (manual review before enrollment) ──
type PkgOpt = { id: string; name: string; price: number | null; currency: string; billingFreq: string };
export function AcceptForm({
  application, athleteName, academyName, packages, groups, coaches,
}: {
  application: { id: string; packageId: string | null };
  athleteName: string;
  academyName: string;
  packages: PkgOpt[];
  groups: Opt[];
  coaches: Opt[];
}) {
  const [packageId, setPackageId] = useState(application.packageId ?? "");
  const [groupId, setGroupId] = useState("");
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

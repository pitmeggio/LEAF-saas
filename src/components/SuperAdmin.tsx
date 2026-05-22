"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  createAcademy, updateAcademy, setAcademyStatus, setAcademyPlan, updateAcademyConfig, type Result,
} from "@/app/super-admin-actions";

const PLANS = ["BASIC", "PRO", "ELITE"] as const;

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-xs text-[var(--color-muted)]";

const ModalCtx = createContext<() => void>(() => {});

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className={lbl}>{label}</label>{children}</div>;
}

function useSubmit() {
  const close = useContext(ModalCtx);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const submit = (fn: () => Promise<Result>) =>
    start(async () => { const r = await fn(); if (r.ok) { close(); router.refresh(); } else setError(r.error ?? "Something went wrong"); });
  return { pending, error, submit };
}

function Modal({ label, title, className, children }: { label: ReactNode; title: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const overlay = (
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

// ── Create academy ───────────────────────────────────────────────────────────
export function CreateAcademyButton() {
  return (
    <Modal label="+ New academy" title="Create academy" className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
      <CreateAcademyForm />
    </Modal>
  );
}

function CreateAcademyForm() {
  const { pending, error, submit } = useSubmit();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const onName = (v: string) => {
    setName(v);
    if (!slugEdited) setSlug(v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        submit(() => createAcademy({
          name: String(fd.get("name") ?? ""),
          slug: String(fd.get("slug") ?? ""),
          country: String(fd.get("country") ?? ""),
          location: String(fd.get("location") ?? ""),
          plan: String(fd.get("plan") ?? "BASIC"),
        }));
      }}
    >
      <Field label="Academy name"><input name="name" className={inp} value={name} onChange={(e) => onName(e.target.value)} required /></Field>
      <Field label="Slug (public URL)">
        <input name="slug" className={inp} value={slug} onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }} required />
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">platform.com/academy/<span className="text-[var(--color-fg)]">{slug || "your-slug"}</span></p>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Country code"><input name="country" className={inp} placeholder="NO" maxLength={2} required /></Field>
        <Field label="Plan">
          <select name="plan" className={inp} defaultValue="BASIC">
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Location (optional)"><input name="location" className={inp} placeholder="Trysil, Norway" /></Field>
      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Edit academy ───────────────────────────────────────────────────────────
type Academy = { id: string; name: string; slug: string; logoColor: string; status: string; plan: string };

export function EditAcademyButton({ academy }: { academy: Academy }) {
  return (
    <Modal label="Edit" title="Edit academy" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
      <EditAcademyForm academy={academy} />
    </Modal>
  );
}

function EditAcademyForm({ academy }: { academy: Academy }) {
  const { pending, error, submit } = useSubmit();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        submit(() => updateAcademy({
          id: academy.id,
          name: String(fd.get("name") ?? ""),
          slug: String(fd.get("slug") ?? ""),
          logoColor: String(fd.get("logoColor") ?? ""),
          status: String(fd.get("status") ?? "active"),
          plan: String(fd.get("plan") ?? "BASIC"),
        }));
      }}
    >
      <Field label="Academy name"><input name="name" className={inp} defaultValue={academy.name} required /></Field>
      <Field label="Slug (public URL)"><input name="slug" className={inp} defaultValue={academy.slug} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Logo colour">
          <div className="flex items-center gap-2">
            <input name="logoColor" className={inp} defaultValue={academy.logoColor} required />
            <span className="h-8 w-8 shrink-0 rounded-lg border border-[var(--color-border)]" style={{ background: academy.logoColor }} />
          </div>
        </Field>
        <Field label="Plan">
          <select name="plan" className={inp} defaultValue={academy.plan}>
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Status">
        <select name="status" className={inp} defaultValue={academy.status}>
          <option value="active">Active</option>
          <option value="inactive">Inactive (locked out)</option>
        </select>
      </Field>
      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Configure tenant (branding + feature flags + limit) ─────────────────────
type AcademyConfig = {
  id: string; name: string; tagline: string | null; description: string | null;
  contactEmail: string | null; logoColor: string; maxAthletes: number | null; requiredDocs: string | null; currency: string;
  featureRecruiting: boolean; featurePublicProfiles: boolean; featureFinance: boolean; featureChat: boolean;
};

const DOC_OPTIONS: { key: string; label: string }[] = [
  { key: "medical_certificate", label: "Medical certificate" },
  { key: "liability_waiver", label: "Liability waiver" },
  { key: "academy_contract", label: "Academy contract" },
  { key: "race_license", label: "Race license" },
  { key: "travel", label: "Travel documents" },
  { key: "parent_approval", label: "Parent approval" },
];
const DEFAULT_DOCS = ["medical_certificate", "liability_waiver", "academy_contract", "race_license"];

const FEATURES: { key: keyof Pick<AcademyConfig, "featureRecruiting" | "featurePublicProfiles" | "featureFinance" | "featureChat">; label: string; desc: string }[] = [
  { key: "featurePublicProfiles", label: "Public profiles", desc: "Athlete profiles + analytics" },
  { key: "featureRecruiting", label: "Recruiting", desc: "Opportunities + applications" },
  { key: "featureFinance", label: "Finance", desc: "Invoices, payments, budgets" },
  { key: "featureChat", label: "Messaging", desc: "Conversations inbox" },
];

export function ConfigureAcademyButton({ academy }: { academy: AcademyConfig }) {
  return (
    <Modal label="Configure" title={`Configure — ${academy.name}`} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
      <ConfigureAcademyForm academy={academy} />
    </Modal>
  );
}

function ConfigureAcademyForm({ academy }: { academy: AcademyConfig }) {
  const { pending, error, submit } = useSubmit();
  const [flags, setFlags] = useState({
    featureRecruiting: academy.featureRecruiting,
    featurePublicProfiles: academy.featurePublicProfiles,
    featureFinance: academy.featureFinance,
    featureChat: academy.featureChat,
  });
  const initialDocs = academy.requiredDocs ? academy.requiredDocs.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_DOCS;
  const [docs, setDocs] = useState<string[]>(initialDocs);
  const toggleDoc = (k: string) => setDocs((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const maxRaw = String(fd.get("maxAthletes") ?? "").trim();
        submit(() => updateAcademyConfig({
          id: academy.id,
          tagline: String(fd.get("tagline") ?? ""),
          description: String(fd.get("description") ?? ""),
          contactEmail: String(fd.get("contactEmail") ?? ""),
          logoColor: String(fd.get("logoColor") ?? ""),
          maxAthletes: maxRaw === "" ? null : Number(maxRaw),
          requiredDocs: docs.join(","),
          ...flags,
        }));
      }}
    >
      <div className="kicker" style={{ color: "var(--color-accent)" }}>Branding</div>
      <Field label="Tagline"><input name="tagline" className={inp} defaultValue={academy.tagline ?? ""} placeholder="Where champions are made" /></Field>
      <Field label="Description"><textarea name="description" rows={3} className={inp} defaultValue={academy.description ?? ""} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact email"><input name="contactEmail" type="email" className={inp} defaultValue={academy.contactEmail ?? ""} /></Field>
        <Field label="Logo colour">
          <div className="flex items-center gap-2">
            <input name="logoColor" className={inp} defaultValue={academy.logoColor} required />
            <span className="h-8 w-8 shrink-0 rounded-lg border border-[var(--color-border)]" style={{ background: academy.logoColor }} />
          </div>
        </Field>
      </div>

      <div className="kicker pt-2" style={{ color: "var(--color-accent)" }}>Modules</div>
      <div className="grid grid-cols-2 gap-2">
        {FEATURES.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFlags((s) => ({ ...s, [f.key]: !s[f.key] }))}
            className={`rounded-lg border px-3 py-2 text-left transition-colors ${flags[f.key] ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)]"}`}
          >
            <div className="flex items-center justify-between text-sm font-medium">
              {f.label}
              <span className={`text-xs ${flags[f.key] ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"}`}>{flags[f.key] ? "On" : "Off"}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{f.desc}</div>
          </button>
        ))}
      </div>

      <div className="kicker pt-2" style={{ color: "var(--color-accent)" }}>Required documents</div>
      <div className="grid grid-cols-2 gap-2">
        {DOC_OPTIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => toggleDoc(d.key)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${docs.includes(d.key) ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)] text-[var(--color-muted)]"}`}
          >
            {docs.includes(d.key) ? "✓ " : ""}{d.label}
          </button>
        ))}
      </div>

      <div className="kicker pt-2" style={{ color: "var(--color-accent)" }}>Limits & currency</div>
      <Field label="Max athletes (blank = unlimited)">
        <input name="maxAthletes" type="number" min={0} className={inp} defaultValue={academy.maxAthletes ?? ""} placeholder="Unlimited" />
      </Field>
      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
        <span className="text-[var(--color-muted)]">Operating currency</span>
        <span className="num font-semibold">{academy.currency || "EUR"} <span className="text-[10px] font-normal text-[var(--color-muted)]">· from country</span></span>
      </div>

      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Inline plan select ───────────────────────────────────────────────────────
export function PlanSelect({ id, plan }: { id: string; plan: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <select
      disabled={pending}
      value={plan}
      onChange={(e) => { const v = e.target.value; start(async () => { await setAcademyPlan({ id, plan: v }); router.refresh(); }); }}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs font-semibold outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
    >
      {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
    </select>
  );
}

// ── Inline status toggle ─────────────────────────────────────────────────────
export function StatusToggle({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const active = status === "active";
  const next = active ? "inactive" : "active";
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await setAcademyStatus({ id, status: next }); router.refresh(); })}
      className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50"
      title={active ? "Deactivate academy" : "Activate academy"}
    >
      {active ? "Deactivate" : "Activate"}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  const color = active ? "#7CFF6B" : "#f87171";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize" style={{ background: `${color}1a`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /> {status}
    </span>
  );
}

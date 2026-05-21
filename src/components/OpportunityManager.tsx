"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  createOpportunity, updateOpportunity, setOpportunityStatus, deleteOpportunity, type Result,
} from "@/app/opportunity-actions";

export type OpportunityRow = {
  id: string;
  title: string;
  type: string;
  season: string | null;
  ageGroup: string | null;
  discipline: string | null;
  packageType: string | null;
  price: number | null;
  currency: string;
  pricePublic: boolean;
  applicationDeadline: string | null; // YYYY-MM-DD
  spotsAvailable: number | null;
  description: string | null;
  status: string;
  applicationsCount: number;
};

const TYPES = ["program", "position", "camp", "package"] as const;
const TYPE_LABEL: Record<string, string> = { program: "Program", position: "Team position", camp: "Camp", package: "Package" };
const STATUS_COLOR: Record<string, string> = { draft: "#8a93a6", published: "#7cff6b", closed: "#f87171" };

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-xs text-[var(--color-muted)]";

const ModalCtx = createContext<() => void>(() => {});

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
          <div className="overflow-y-auto px-6 py-5"><ModalCtx.Provider value={close}>{children}</ModalCtx.Provider></div>
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

function useSubmit() {
  const close = useContext(ModalCtx);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const submit = (fn: () => Promise<Result>) =>
    start(async () => { const r = await fn(); if (r.ok) { close(); router.refresh(); } else setError(r.error ?? "Something went wrong"); });
  return { pending, error, submit };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className={lbl}>{label}</label>{children}</div>;
}

function OpportunityForm({ initial }: { initial?: OpportunityRow }) {
  const { pending, error, submit } = useSubmit();
  const [pricePublic, setPricePublic] = useState(initial?.pricePublic ?? false);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const num = (k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? null : Number(v); };
        const str = (k: string) => { const v = String(fd.get(k) ?? "").trim(); return v === "" ? undefined : v; };
        const payload = {
          title: String(fd.get("title") ?? ""),
          type: String(fd.get("type") ?? "program") as (typeof TYPES)[number],
          season: str("season"),
          ageGroup: str("ageGroup"),
          discipline: str("discipline"),
          packageType: str("packageType"),
          price: num("price"),
          currency: "EUR",
          pricePublic,
          applicationDeadline: str("applicationDeadline"),
          spotsAvailable: num("spotsAvailable"),
          description: str("description"),
          status: String(fd.get("status") ?? "draft") as "draft" | "published" | "closed",
        };
        submit(() => (initial ? updateOpportunity(initial.id, payload) : createOpportunity(payload)));
      }}
    >
      <Field label="Title *"><input name="title" className={inp} defaultValue={initial?.title} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select name="type" className={inp} defaultValue={initial?.type ?? "program"}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" className={inp} defaultValue={initial?.status ?? "draft"}>
            <option value="draft">Draft (hidden)</option>
            <option value="published">Published (public)</option>
            <option value="closed">Closed</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Season"><input name="season" className={inp} defaultValue={initial?.season ?? ""} placeholder="2026/27" /></Field>
        <Field label="Age group"><input name="ageGroup" className={inp} defaultValue={initial?.ageGroup ?? ""} placeholder="U16-U18" /></Field>
        <Field label="Discipline"><input name="discipline" className={inp} defaultValue={initial?.discipline ?? ""} placeholder="GS / SL" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Package type"><input name="packageType" className={inp} defaultValue={initial?.packageType ?? ""} placeholder="Full season" /></Field>
        <Field label="Spots available"><input name="spotsAvailable" type="number" min={0} className={inp} defaultValue={initial?.spotsAvailable ?? ""} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (EUR)"><input name="price" type="number" min={0} className={inp} defaultValue={initial?.price ?? ""} /></Field>
        <Field label="Application deadline"><input name="applicationDeadline" type="date" className={inp} defaultValue={initial?.applicationDeadline ?? ""} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={pricePublic} onChange={(e) => setPricePublic(e.target.checked)} /> Show price publicly
      </label>
      <Field label="Description"><textarea name="description" className={`${inp} min-h-20`} defaultValue={initial?.description ?? ""} placeholder="What this opening offers and who it's for…" /></Field>
      {error && <p className="text-sm text-[#f87171]">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          {pending ? "Saving…" : initial ? "Save" : "Create opportunity"}
        </button>
      </div>
    </form>
  );
}

function StatusActions({ o }: { o: OpportunityRow }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (fn: () => Promise<Result>) => start(async () => { await fn(); router.refresh(); });
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {o.status !== "published" && (
        <button disabled={pending} onClick={() => act(() => setOpportunityStatus(o.id, "published"))} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50">Publish</button>
      )}
      {o.status === "published" && (
        <button disabled={pending} onClick={() => act(() => setOpportunityStatus(o.id, "draft"))} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50">Unpublish</button>
      )}
      {o.status !== "closed" && (
        <button disabled={pending} onClick={() => act(() => setOpportunityStatus(o.id, "closed"))} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50">Close</button>
      )}
      <Modal label="Edit" title="Edit opportunity" className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-2)]">
        <OpportunityForm initial={o} />
      </Modal>
      <button disabled={pending} onClick={() => { if (confirm("Delete this opportunity? Applications are kept but detached.")) act(() => deleteOpportunity(o.id)); }} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[#f87171] hover:bg-[var(--color-surface-2)] disabled:opacity-50">Delete</button>
    </div>
  );
}

export function OpportunityManager({ opportunities }: { opportunities: OpportunityRow[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Open applications & opportunities</h2>
          <p className="text-xs text-[var(--color-muted)]">Publish programs, team positions, camps and packages. Published ones appear on your public academy page.</p>
        </div>
        <Modal label="+ New opportunity" title="New opportunity" className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
          <OpportunityForm />
        </Modal>
      </div>
      {opportunities.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">No opportunities yet. Create your first opening.</div>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {opportunities.map((o) => (
              <tr key={o.id} className="border-t border-[var(--color-border)] first:border-t-0">
                <td className="px-5 py-3">
                  <div className="font-medium">{o.title}</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {TYPE_LABEL[o.type] ?? o.type}
                    {o.season ? ` · ${o.season}` : ""}{o.ageGroup ? ` · ${o.ageGroup}` : ""}{o.discipline ? ` · ${o.discipline}` : ""}
                    {o.spotsAvailable != null ? ` · ${o.spotsAvailable} spots` : ""}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize" style={{ color: STATUS_COLOR[o.status] }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[o.status] }} /> {o.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-[var(--color-muted)]">{o.applicationsCount} application{o.applicationsCount === 1 ? "" : "s"}</td>
                <td className="px-5 py-3"><StatusActions o={o} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

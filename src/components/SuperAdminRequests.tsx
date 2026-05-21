"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { reviewAcademyRequest, type Result } from "@/app/super-admin-actions";

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

function slugify(s: string) {
  return s.toLowerCase().trim().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

type Req = { id: string; academyName: string; plan: string };

export function ReviewRequestButton({ request }: { request: Req }) {
  return (
    <Modal label="Review" title={`Review — ${request.academyName}`} className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
      <ReviewForm request={request} />
    </Modal>
  );
}

function ReviewForm({ request }: { request: Req }) {
  const { pending, error, submit } = useSubmit();
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [slug, setSlug] = useState(slugify(request.academyName));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        submit(() => reviewAcademyRequest({
          id: request.id,
          action,
          slug: action === "approve" ? slug : undefined,
          plan: action === "approve" ? String(fd.get("plan") ?? request.plan) : undefined,
          reviewerNote: String(fd.get("reviewerNote") ?? ""),
        }));
      }}
    >
      <div className="flex rounded-xl border border-[var(--color-border)] p-0.5">
        {(["approve", "reject"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAction(a)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
              action === a
                ? a === "approve" ? "bg-[var(--color-accent)] text-[#0a0c10]" : "bg-[#f87171] text-white"
                : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {action === "approve" ? (
        <>
          <Field label="Slug (public URL)">
            <input className={inp} value={slug} onChange={(e) => setSlug(e.target.value)} required />
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">platform.com/academy/<span className="text-[var(--color-fg)]">{slug || "your-slug"}</span></p>
          </Field>
          <Field label="Plan">
            <select name="plan" className={inp} defaultValue={request.plan}>
              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-muted)]">
            Approving creates the academy with the plan's default modules + limit, and an owner account for the contact (they set their password on first sign-in).
          </p>
        </>
      ) : (
        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-muted)]">
          The request will be marked rejected. No tenant or account is created.
        </p>
      )}

      <Field label="Internal note (optional)"><textarea name="reviewerNote" rows={2} className={inp} /></Field>

      {error && <p className="text-sm text-[#f87171]">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          {pending ? "Working…" : action === "approve" ? "Approve & provision" : "Reject request"}
        </button>
      </div>
    </form>
  );
}

export function RequestStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { pending: "#f59e0b", approved: "#7CFF6B", rejected: "#f87171" };
  const color = map[status] ?? "#9aa4b2";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize" style={{ background: `${color}1a`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /> {status}
    </span>
  );
}

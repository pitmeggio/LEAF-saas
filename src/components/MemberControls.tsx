"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setEnrollmentStatus,
  reassignEnrollment,
  archiveEnrollment,
  updateEnrollmentNotes,
  setPaymentStatus,
  updateDocument,
} from "@/app/ops-actions";
import { ENROLLMENT_STATUSES } from "@/lib/domain";

type Opt = { id: string; name: string };

const sel =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-sm capitalize outline-none focus:border-[var(--color-accent)] disabled:opacity-50";

function useAction() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  return { pending, run };
}

export function ManagePanel({
  enrollmentId,
  status,
  groupId,
  coachId,
  packageId,
  groups,
  coaches,
  packages,
}: {
  enrollmentId: string;
  status: string;
  groupId: string | null;
  coachId: string | null;
  packageId: string | null;
  groups: Opt[];
  coaches: Opt[];
  packages: Opt[];
}) {
  const { pending, run } = useAction();

  return (
    <div className="card p-6">
      <h3 className="mb-3 text-sm font-semibold">Manage</h3>
      <div className="space-y-3">
        <Field label="Status">
          <select className={sel} value={status} disabled={pending} onChange={(e) => run(() => setEnrollmentStatus(enrollmentId, e.target.value))}>
            {ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Group">
          <select className={sel} value={groupId ?? ""} disabled={pending} onChange={(e) => run(() => reassignEnrollment(enrollmentId, "group", e.target.value || null))}>
            <option value="">Unassigned</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Coach">
          <select className={sel} value={coachId ?? ""} disabled={pending} onChange={(e) => run(() => reassignEnrollment(enrollmentId, "coach", e.target.value || null))}>
            <option value="">Unassigned</option>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Package">
          <select className={sel} value={packageId ?? ""} disabled={pending} onChange={(e) => run(() => reassignEnrollment(enrollmentId, "package", e.target.value || null))}>
            <option value="">None</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      {status !== "inactive" && (
        <button
          disabled={pending}
          onClick={() => { if (confirm("Archive this athlete? Status will be set to inactive.")) run(() => archiveEnrollment(enrollmentId)); }}
          className="mt-4 w-full rounded-lg border border-[#f8717140] px-3 py-2 text-sm font-medium text-[#f87171] hover:bg-[#f8717112] disabled:opacity-50"
        >
          Archive athlete
        </button>
      )}
    </div>
  );
}

export function NotesEditor({ enrollmentId, notes }: { enrollmentId: string; notes: string }) {
  const [value, setValue] = useState(notes);
  const { pending, run } = useAction();
  const dirty = value !== notes;
  return (
    <div className="card p-6">
      <h3 className="mb-3 text-sm font-semibold">Coach notes</h3>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Internal notes about this athlete…"
        className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <div className="mt-2 flex justify-end">
        <button
          disabled={pending || !dirty}
          onClick={() => run(() => updateEnrollmentNotes(enrollmentId, value))}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save notes"}
        </button>
      </div>
    </div>
  );
}

export function PaymentControl({ paymentId, status, amount, paidAmount, currency = "EUR" }: { paymentId: string; status: string; amount: number; paidAmount: number; currency?: string }) {
  const { pending, run } = useAction();
  const [showPartial, setShowPartial] = useState(false);
  const [partial, setPartial] = useState(String(paidAmount || Math.round(amount / 2)));

  if (status === "paid") {
    return (
      <button disabled={pending} onClick={() => run(() => setPaymentStatus(paymentId, "unpaid"))}
        className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] disabled:opacity-50">
        Mark unpaid
      </button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {showPartial ? (
        <>
          <input type="number" min={1} max={amount} value={partial} onChange={(e) => setPartial(e.target.value)}
            className="num w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]" />
          <button disabled={pending} onClick={() => run(() => setPaymentStatus(paymentId, "partial", { amount: Number(partial) || 0 }))}
            className="rounded-md bg-[var(--color-accent)] px-2 py-1 text-xs font-semibold text-[#0a0c10] disabled:opacity-50">Save</button>
          <button onClick={() => setShowPartial(false)} aria-label="Cancel partial payment" className="text-xs text-[var(--color-muted)]">✕</button>
        </>
      ) : (
        <>
          <button disabled={pending} onClick={() => run(() => setPaymentStatus(paymentId, "paid"))}
            className="rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">Mark paid</button>
          <button onClick={() => setShowPartial(true)} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-surface-2)]">Partial</button>
        </>
      )}
    </div>
  );
}

export function DocumentControl({ documentId, status, expiresAt }: { documentId: string; status: string; expiresAt: string | null }) {
  const [date, setDate] = useState(expiresAt ?? "");
  const { pending, run } = useAction();
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={date}
        disabled={pending}
        onChange={(e) => { setDate(e.target.value); run(() => updateDocument(documentId, status, e.target.value || undefined)); }}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
      />
      <select
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs capitalize outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
        value={status}
        disabled={pending}
        onChange={(e) => run(() => updateDocument(documentId, e.target.value, date || undefined))}
      >
        <option value="missing">Missing</option>
        <option value="uploaded">Uploaded</option>
        <option value="verified">Verified</option>
        <option value="expired">Expired</option>
      </select>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--color-muted)]">{label}</label>
      {children}
    </div>
  );
}

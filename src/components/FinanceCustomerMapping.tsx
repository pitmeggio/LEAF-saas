"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEnrollmentExternalId } from "@/app/finance-actions";

// Per-enrollment mapping to the external finance system's customer id. This is the
// key syncAcademyFinance() uses to attach synced invoices to this athlete.
export function FinanceCustomerMapping({ enrollmentId, value }: { enrollmentId: string; value: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(value ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    setMsg(null); setErr(null);
    start(async () => {
      const r = await setEnrollmentExternalId(enrollmentId, v);
      if (r.ok) { setMsg(r.message ?? "Saved"); router.refresh(); } else setErr(r.error ?? "Something went wrong");
    });
  };

  return (
    <div className="card p-6">
      <h3 className="mb-1 text-sm font-semibold">Finance customer ID</h3>
      <p className="mb-3 text-xs text-[var(--color-muted)]">
        The customer ID in your billing system. LEAF uses it to attach this athlete&apos;s synced invoices.
      </p>
      <div className="flex gap-2">
        <input
          value={v}
          onChange={(e) => { setV(e.target.value); setMsg(null); setErr(null); }}
          placeholder="e.g. CUST-1042"
          className="num w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button onClick={save} disabled={pending} className="shrink-0 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          {pending ? "…" : "Save"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-[#7cff6b]">{msg}</p>}
      {err && <p className="mt-2 text-xs text-[#f87171]">{err}</p>}
    </div>
  );
}

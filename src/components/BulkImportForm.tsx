"use client";

import { useActionState } from "react";
import { bulkImportAthletes, type BulkState } from "@/app/bulk-actions";

const SAMPLE = `firstName,lastName,email,nationality,gender,discipline,dob,fisPoints,fisCode
Lars,Berg,lars@example.com,NO,M,slalom,2007-03-12,28.4,
Emma,Holm,emma@example.com,SE,F,giant_slalom,2008-09-01,41.2,`;

export function BulkImportForm() {
  const [state, formAction, pending] = useActionState<BulkState, FormData>(bulkImportAthletes, {});

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold">Bulk import (CSV / Excel)</h3>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Paste rows from Excel or a CSV. First row is the header. Required: <span className="num">firstName</span>, <span className="num">lastName</span>.
        Optional: email, nationality, gender, discipline, dob, fisPoints, fisCode. Each athlete is added to your active roster (deduped by email/FIS code).
      </p>

      <form action={formAction} className="mt-4 space-y-3">
        <textarea
          name="csv"
          rows={8}
          defaultValue={SAMPLE}
          spellCheck={false}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-accent)]"
        />
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          {pending ? "Importing…" : "Import athletes"}
        </button>
      </form>

      {state.done && (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm">
          <div className="flex flex-wrap gap-4">
            <span><span className="num font-bold text-[var(--color-accent)]">{state.created ?? 0}</span> created</span>
            <span><span className="num font-bold">{state.linked ?? 0}</span> linked</span>
            <span><span className="num font-bold text-[var(--color-muted)]">{state.skipped ?? 0}</span> already on roster</span>
          </div>
          {state.errors && state.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-[#f87171]">
              {state.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

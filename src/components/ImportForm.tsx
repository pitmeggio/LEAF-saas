"use client";

import { useActionState } from "react";
import { importFisAction, type ImportState } from "@/app/fis-actions";

export function ImportForm({ demoCodes }: { demoCodes: string[] }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importFisAction, {});

  return (
    <div className="card p-6">
      <form action={formAction} className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="fisCode">
          FIS code
        </label>
        <div className="flex gap-2">
          <input
            id="fisCode"
            name="fisCode"
            placeholder="e.g. 6294001"
            autoComplete="off"
            className="num flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
          >
            {pending ? "Importing…" : "Import"}
          </button>
        </div>
        {state.error && <p className="text-sm text-[#f87171]">{state.error}</p>}
      </form>

      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">Try a demo code</div>
        <div className="flex flex-wrap gap-2">
          {demoCodes.map((c) => (
            <form key={c} action={formAction}>
              <input type="hidden" name="fisCode" value={c} />
              <button
                type="submit"
                disabled={pending}
                className="num rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-[var(--color-fg)] hover:border-[var(--color-accent)]/60 disabled:opacity-50"
              >
                {c}
              </button>
            </form>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Any code works — unknown codes generate a deterministic record. Re-importing an existing code updates that
          athlete&apos;s profile and history.
        </p>
      </div>
    </div>
  );
}

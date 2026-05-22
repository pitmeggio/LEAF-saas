"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectFinanceProvider, disconnectFinance, syncFinanceNow } from "@/app/finance-actions";
import { FINANCE_PROVIDERS, financeProviderLabel } from "@/lib/finance";

export function FinanceConnection({ provider, syncedAt }: { provider: string | null; syncedAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [choice, setChoice] = useState<string>(FINANCE_PROVIDERS.find((p) => p.available)?.key ?? "");

  const connected = !!provider;
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setMsg(null); setErr(null);
    start(async () => {
      const r = await fn();
      if (r.ok) { setMsg(r.message ?? "Done"); router.refresh(); } else setErr(r.error ?? "Something went wrong");
    });
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Finance source</h2>
          <p className="mt-0.5 max-w-xl text-xs text-[var(--color-muted)]">
            LEAF doesn&apos;t issue invoices — connect your billing software and LEAF reads and analyses your invoices and payments. Matched to athletes by external customer ID.
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={connected ? { background: "#7cff6b1a", color: "var(--color-accent)" } : { background: "var(--color-surface-2)", color: "var(--color-muted)" }}
        >
          {connected ? `● ${financeProviderLabel(provider)}` : "○ LEAF-managed"}
        </span>
      </div>

      {connected ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => run(syncFinanceNow)} disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
            {pending ? "Syncing…" : "Sync now"}
          </button>
          <button onClick={() => run(disconnectFinance)} disabled={pending} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50">
            Disconnect
          </button>
          <span className="text-xs text-[var(--color-muted)]">
            {syncedAt ? `Last synced ${syncedAt}` : "Not synced yet"}
          </span>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select value={choice} onChange={(e) => setChoice(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
            {FINANCE_PROVIDERS.map((p) => (
              <option key={p.key} value={p.key} disabled={!p.available}>
                {p.label}{p.available ? "" : " — coming soon"}
              </option>
            ))}
          </select>
          <button onClick={() => run(() => connectFinanceProvider(choice))} disabled={pending || !choice} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
            {pending ? "Connecting…" : "Connect"}
          </button>
        </div>
      )}

      {msg && <p className="mt-3 text-xs text-[#7cff6b]">{msg}</p>}
      {err && <p className="mt-3 text-xs text-[#f87171]">{err}</p>}
    </div>
  );
}

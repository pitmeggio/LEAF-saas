"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContract, setContractStatus, deleteContract } from "@/app/contract-actions";

type Contract = {
  id: string; title: string; status: string;
  startDate: string | null; endDate: string | null; value: number | null; currency: string; notes: string | null;
};

const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#9aa4b6" },
  sent: { label: "Sent", color: "#38bdf8" },
  signed: { label: "Signed", color: "var(--color-accent)" },
  expired: { label: "Expired", color: "#f87171" },
};
const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;
}

export function ContractsPanel({ enrollmentId, contracts }: { enrollmentId: string; contracts: Contract[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", startDate: "", endDate: "", value: "", notes: "" });

  const create = () => {
    if (!f.title.trim()) return;
    start(async () => {
      const r = await createContract({
        enrollmentId, title: f.title, status: "draft",
        startDate: f.startDate || undefined, endDate: f.endDate || undefined,
        value: f.value ? Number(f.value) : null, notes: f.notes || undefined,
      });
      if (r.ok) { setF({ title: "", startDate: "", endDate: "", value: "", notes: "" }); setAdding(false); router.refresh(); }
      else alert(r.error);
    });
  };
  const changeStatus = (id: string, status: string) => start(async () => { await setContractStatus({ id, status }); router.refresh(); });
  const remove = (id: string) => { if (confirm("Delete this contract?")) start(async () => { await deleteContract(id); router.refresh(); }); };

  return (
    <div className="card p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Contracts</h3>
        <button onClick={() => setAdding((v) => !v)} className="text-xs font-medium text-[var(--color-accent)] hover:underline">{adding ? "Cancel" : "+ Add contract"}</button>
      </div>

      {adding && (
        <div className="mb-4 space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
          <input className={inp} placeholder="Title (e.g. 2026/27 Full Season Agreement)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-[var(--color-muted)]">Start<input type="date" className={inp} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></label>
            <label className="text-[11px] text-[var(--color-muted)]">End<input type="date" className={inp} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
          </div>
          <input type="number" className={inp} placeholder="Value (optional)" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
          <textarea rows={2} className={`${inp} resize-none`} placeholder="Notes (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <button onClick={create} disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">{pending ? "Saving…" : "Create"}</button>
        </div>
      )}

      {contracts.length === 0 && !adding && <p className="text-sm text-[var(--color-muted)]">No contracts yet.</p>}

      <div className="space-y-2">
        {contracts.map((c) => {
          const st = STATUS[c.status] ?? STATUS.draft;
          return (
            <div key={c.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.title}</div>
                  <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                    {[fmt(c.startDate), fmt(c.endDate)].filter(Boolean).join(" → ") || "No term set"}
                    {c.value != null ? ` · ${c.currency} ${c.value.toLocaleString("en-US")}` : ""}
                  </div>
                  {c.notes && <div className="mt-1 text-xs text-[var(--color-fg)]/75">{c.notes}</div>}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ background: `${st.color}1a`, color: st.color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />{st.label}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select disabled={pending} value={c.status} onChange={(e) => changeStatus(c.id, e.target.value)} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]">
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <button onClick={() => remove(c.id)} disabled={pending} className="text-xs text-[#f87171] hover:underline">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

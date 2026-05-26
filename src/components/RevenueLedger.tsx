"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRevenue, deleteRevenue } from "@/app/revenue-actions";

// Inline ledger for adding income entries — sponsor, federation grants,
// academy allocations, misc revenue. Pre-bound to a group when present,
// or academy-wide when groupId is null.

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "sponsor", label: "Sponsor" },
  { value: "federation", label: "Federation" },
  { value: "academy_allocation", label: "Academy allocation" },
  { value: "athlete_fee", label: "Athlete fee (manual)" },
  { value: "other", label: "Other" },
];
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "received", label: "Received" },
  { value: "pledged", label: "Pledged" },
  { value: "cancelled", label: "Cancelled" },
];

export type RevenueRow = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  status: string;
  source: string | null;
  receivedDate: Date | string | null;
  notes: string | null;
};

export function RevenueLedger({
  groupId,
  currency,
  rows,
  title = "Income",
}: {
  groupId: string | null;
  currency: string;
  rows: RevenueRow[];
  title?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, set] = useState({
    title: "",
    amount: "" as string | number,
    category: "sponsor",
    status: "received",
    source: "",
    receivedDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const inp = "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs focus:border-[var(--color-accent)] focus:outline-none";

  function submit() {
    setErr(null);
    const amount = Number(f.amount);
    if (!f.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      setErr("Title + positive amount are required.");
      return;
    }
    start(async () => {
      const res = await createRevenue({
        title: f.title.trim(),
        amount,
        currency,
        category: f.category as Parameters<typeof createRevenue>[0]["category"],
        status: f.status as Parameters<typeof createRevenue>[0]["status"],
        groupId: groupId ?? null,
        ...(f.source ? { source: f.source } : {}),
        ...(f.notes ? { notes: f.notes } : {}),
        ...(f.receivedDate ? { receivedDate: f.receivedDate } : {}),
      } as Parameters<typeof createRevenue>[0]);
      if (!res.ok) { setErr(res.error); return; }
      setOpen(false);
      set({ title: "", amount: "", category: "sponsor", status: "received", source: "", receivedDate: new Date().toISOString().slice(0, 10), notes: "" });
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{title}</div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[10px] font-medium text-[var(--color-accent)] hover:underline"
        >
          {open ? "Cancel" : "+ Add"}
        </button>
      </div>

      {open && (
        <div className="mb-3 rounded-lg border border-[var(--color-border)] p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input className={inp} placeholder="Title (e.g. Sponsor deal Q1)" value={f.title} onChange={(e) => set({ ...f, title: e.target.value })} />
            <input className={inp} type="number" min={1} placeholder={`Amount (${currency})`} value={f.amount} onChange={(e) => set({ ...f, amount: e.target.value })} />
            <select className={inp} value={f.category} onChange={(e) => set({ ...f, category: e.target.value })}>
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select className={inp} value={f.status} onChange={(e) => set({ ...f, status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input className={inp} placeholder="Source (e.g. Salomon, FIS, Trysil)" value={f.source} onChange={(e) => set({ ...f, source: e.target.value })} />
            <input type="date" className={inp} value={f.receivedDate} onChange={(e) => set({ ...f, receivedDate: e.target.value })} />
            <input className={`${inp} sm:col-span-2`} placeholder="Notes (optional)" value={f.notes} onChange={(e) => set({ ...f, notes: e.target.value })} />
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            {err && <span className="text-xs text-[#f87171]">{err}</span>}
            <button
              type="button"
              disabled={pending || !f.title.trim() || !f.amount}
              onClick={submit}
              className="rounded-md bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save income"}
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">No income entries yet.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs">
              <span className="rounded-sm bg-[var(--color-surface)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--color-muted)]">{r.category.replace(/_/g, " ")}</span>
              <span className="min-w-0 truncate font-medium">{r.title}</span>
              {r.source && <span className="text-[10px] text-[var(--color-muted)]">· {r.source}</span>}
              <span className="num ml-auto font-semibold" style={{ color: r.status === "received" ? "var(--color-accent)" : r.status === "cancelled" ? "var(--color-muted)" : "#f59e0b" }}>
                {new Intl.NumberFormat("en-GB", { style: "currency", currency: r.currency, maximumFractionDigits: 0 }).format(r.amount)}
              </span>
              {r.status !== "received" && <span className="text-[9px] uppercase text-[var(--color-muted)]">{r.status}</span>}
              <DeleteRevenue id={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeleteRevenue({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title="Delete"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this income entry?")) return;
        start(async () => {
          const res = await deleteRevenue({ id });
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
      className="text-[10px] text-[var(--color-muted)] hover:text-[#f87171] disabled:opacity-50"
    >
      ✕
    </button>
  );
}

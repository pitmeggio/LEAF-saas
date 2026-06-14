"use client";

import { useState } from "react";

// Accountant export controls — pick a period, then download the CSV (machine
// import for the regnskapsfører) or open the printable report (human bilag
// bundle with receipt images). Admin-only; rendered on the Expenses page.
export function ExpenseExportBar() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = () => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const inp = "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        From
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        To
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} />
      </label>
      <a
        href={`/api/expenses/export${qs()}`}
        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]"
      >
        ⤓ Export CSV
      </a>
      <a
        href={`/dashboard/expenses/report${qs()}`}
        target="_blank"
        rel="noopener"
        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]"
      >
        🖨 Printable report
      </a>
    </div>
  );
}

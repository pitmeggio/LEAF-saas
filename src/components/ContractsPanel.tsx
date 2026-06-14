"use client";

// Contracts panel — VISUAL ONLY by request. The app no longer creates,
// edits, signs or deletes contracts (academies handle that in their
// existing legal stack). LEAF just renders what's already on file so the
// coach has the term + status visible alongside the athlete profile.
//
// The contract-actions server actions still exist for super-admin
// migration tooling, but no UI surface calls them.

type Contract = {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  value: number | null;
  currency: string;
  notes: string | null;
};

const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#9aa4b6" },
  sent: { label: "Sent", color: "#38bdf8" },
  signed: { label: "Signed", color: "var(--color-accent)" },
  expired: { label: "Expired", color: "#f87171" },
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;
}

export function ContractsPanel({ contracts }: { enrollmentId: string; contracts: Contract[] }) {
  return (
    <div className="card p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Contracts</h3>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          view only
        </span>
      </div>

      {contracts.length === 0 && (
        <p className="text-sm text-[var(--color-muted)]">No contracts on file.</p>
      )}

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
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ background: `${st.color}1a`, color: st.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                  {st.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

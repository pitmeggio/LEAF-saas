import type { GroupSuggestion } from "@/lib/ai/groupAssignment";

// Read-only, explainable Smart Group Assignment card. Advisory only — the actual
// assignment happens in the Accept & enroll flow, where the coach can override.
export function GroupSuggestions({ suggestions }: { suggestions: GroupSuggestion[] }) {
  const ranked = suggestions.slice(0, 4);
  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
        <h3 className="text-sm font-semibold">Smart group assignment</h3>
      </div>
      <p className="mb-3 text-xs text-[var(--color-muted)]">LEAF suggests — you decide. Override anytime in Accept &amp; enroll.</p>

      <div className="space-y-2.5">
        {ranked.map((s) => (
          <div
            key={s.groupId}
            className="rounded-lg border p-3"
            style={{
              borderColor: s.recommended ? "var(--color-accent)" : "var(--color-border)",
              background: s.recommended ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "var(--color-surface-2)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{s.groupName}</span>
                {s.recommended && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>
                    Recommended
                  </span>
                )}
                {!s.eligible && !s.recommended && (
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">ineligible</span>
                )}
              </div>
              <FitScore value={s.fitScore} />
            </div>
            <ul className="mt-2 space-y-1">
              {s.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs leading-snug">
                  <span style={{ color: r.kind === "good" ? "var(--color-accent)" : r.kind === "warn" ? "#f87171" : "var(--color-muted)" }}>
                    {r.kind === "good" ? "✓" : r.kind === "warn" ? "!" : "·"}
                  </span>
                  <span className="text-[var(--color-fg)]/85">{r.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function FitScore({ value }: { value: number }) {
  const color = value >= 70 ? "var(--color-accent)" : value >= 45 ? "#f59e0b" : "#f87171";
  return (
    <div className="flex items-center gap-1.5">
      <span className="num text-sm font-bold" style={{ color }}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">fit</span>
    </div>
  );
}

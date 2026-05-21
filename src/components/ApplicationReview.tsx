import type { ApplicationReview } from "@/lib/ai/applicationReview";

const BAND: Record<ApplicationReview["band"], { label: string; color: string }> = {
  strong: { label: "Strong fit", color: "var(--color-accent)" },
  moderate: { label: "Moderate fit", color: "#f59e0b" },
  weak: { label: "Weak fit", color: "#f87171" },
};
const SEV: Record<"high" | "medium" | "low", string> = { high: "#f87171", medium: "#f59e0b", low: "var(--color-muted)" };

export function ApplicationReviewCard({ review }: { review: ApplicationReview }) {
  const band = BAND[review.band];
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
        <h3 className="text-sm font-semibold">Application review</h3>
      </div>

      {/* Fit score */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2" style={{ borderColor: band.color }}>
          <span className="num text-xl font-bold" style={{ color: band.color }}>{review.fitScore}</span>
          <span className="text-[8px] uppercase tracking-wide text-[var(--color-muted)]">fit</span>
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: band.color }}>{band.label}</div>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">LEAF suggests — the decision is always yours.</p>
        </div>
      </div>

      {/* Score factors */}
      <div className="mt-4 space-y-1">
        {review.factors.map((f, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-fg)]/80">{f.label}</span>
            <span className="num font-semibold" style={{ color: f.delta >= 0 ? "var(--color-accent)" : "#f87171" }}>{f.delta >= 0 ? "+" : ""}{f.delta}</span>
          </div>
        ))}
      </div>

      {/* Risk flags */}
      {review.flags.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-3">
          <div className="mb-2 text-xs font-semibold text-[var(--color-muted)]">Risk flags</div>
          <ul className="space-y-1.5">
            {review.flags.map((fl, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: SEV[fl.severity] }} />
                <span className="text-[var(--color-fg)]/85">{fl.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

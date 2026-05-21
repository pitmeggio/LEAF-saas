import type { Recommendation } from "@/lib/ai/recommendations";

const PRI: Record<Recommendation["priority"], { color: string; label: string }> = {
  high: { color: "#f87171", label: "High" },
  medium: { color: "#f59e0b", label: "Medium" },
  low: { color: "var(--color-accent)", label: "Focus" },
};

export function RecommendationsCard({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) return null;
  return (
    <section>
      <div className="mb-5 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
        <div className="kicker" style={{ color: "var(--color-accent)" }}>LEAF intelligence</div>
        <h2 className="text-2xl font-bold tracking-tight">Recommendations</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {recommendations.map((r, i) => {
          const p = PRI[r.priority];
          return (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{r.focus}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `color-mix(in srgb, ${p.color} 16%, transparent)`, color: p.color }}>{p.label}</span>
              </div>
              <p className="mt-1.5 text-sm leading-snug text-[var(--color-fg)]/90">{r.action}</p>
              <p className="mt-1.5 text-xs leading-snug text-[var(--color-muted)]">{r.why}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-[var(--color-muted)]">AI guidance from your competition record — discuss with your coach.</p>
    </section>
  );
}

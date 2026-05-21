import type { AthleteInsight } from "@/lib/ai/athleteInsights";

const STYLE: Record<AthleteInsight["kind"], { color: string; mark: string; tag: string }> = {
  strength: { color: "var(--color-accent)", mark: "▲", tag: "Strength" },
  watch: { color: "#f59e0b", mark: "!", tag: "Watch" },
  info: { color: "var(--color-muted)", mark: "·", tag: "Context" },
};

export function AthleteInsights({ insights }: { insights: AthleteInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <section>
      <div className="mb-5 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
        <div className="kicker" style={{ color: "var(--color-accent)" }}>LEAF intelligence</div>
        <h2 className="text-2xl font-bold tracking-tight">Performance insights</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {insights.map((ins, i) => {
          const s = STYLE[ins.kind];
          return (
            <div key={i} className="card flex gap-3 p-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)`, color: s.color }}>
                {s.mark}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{ins.title}</span>
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: s.color }}>{s.tag}</span>
                </div>
                <p className="mt-0.5 text-sm leading-snug text-[var(--color-muted)]">{ins.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

import type { AcademyHealth } from "@/lib/ai/academyHealth";

const KIND: Record<"strength" | "watch" | "info", { color: string; mark: string }> = {
  strength: { color: "var(--color-accent)", mark: "▲" },
  watch: { color: "#f59e0b", mark: "!" },
  info: { color: "var(--color-muted)", mark: "·" },
};

export function AcademyHealthPanel({ health, mrrLabel }: { health: AcademyHealth; mrrLabel: string }) {
  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
        <h3 className="text-sm font-semibold">Academy health</h3>
        <span className="text-xs text-[var(--color-muted)]">· read from live data</span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Collection rate" hint="fees collected vs billed" value={`${health.collectionRate}%`} good={health.collectionRate >= 90} warn={health.collectionRate < 75} />
        <Metric label="Occupancy" hint="group spots filled" value={`${health.occupancyPct}%`} good={health.occupancyPct >= 85} warn={health.occupancyPct <= 50} />
        <Metric label="Retention" hint="athletes still active" value={`${health.retentionRate}%`} good={health.retentionRate >= 95} warn={health.retentionRate < 85} />
        <Metric label={mrrLabel} hint="expected monthly income" value={`€${health.mrr.toLocaleString("en-US")}`} />
      </div>

      {health.insights.length > 0 && (
        <div className="mt-4 grid gap-2 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
          {health.insights.map((ins, i) => {
            const k = KIND[ins.kind];
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${k.color} 16%, transparent)`, color: k.color }}>{k.mark}</span>
                <div className="text-xs leading-snug">
                  <span className="font-semibold">{ins.title}</span>
                  <span className="text-[var(--color-muted)]"> — {ins.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, hint, good, warn }: { label: string; value: string; hint?: string; good?: boolean; warn?: boolean }) {
  const color = warn ? "#f87171" : good ? "var(--color-accent)" : undefined;
  return (
    <div>
      <div className="kicker">{label}</div>
      <div className="num mt-1 text-2xl font-bold tracking-tight" style={color ? { color } : undefined}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}

import type { Forecast } from "@/lib/ai/forecast";

const CONF: Record<Forecast["confidence"], string> = { low: "Low", medium: "Medium", high: "High" };
const RISK: Record<"low" | "medium" | "high", string> = { low: "var(--color-accent)", medium: "#f59e0b", high: "#f87171" };

export function ForecastCard({ forecast, pointsLabel }: { forecast: Forecast; pointsLabel: string }) {
  if (!forecast.enoughData) return null;
  const improving = forecast.improving;
  const arrow = improving ? "↘" : (forecast.deltaPoints ?? 0) === 0 ? "→" : "↗";
  const deltaColor = improving ? "var(--color-accent)" : "#f87171";

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
        <h3 className="text-sm font-semibold">Projected trajectory</h3>
        <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--color-muted)]">beta</span>
      </div>

      <div className="flex items-end gap-6">
        <div>
          <div className="kicker">Now</div>
          <div className="num text-2xl font-bold">{forecast.currentPoints}</div>
        </div>
        <div className="pb-1 text-2xl" style={{ color: deltaColor }}>{arrow}</div>
        <div>
          <div className="kicker">In {forecast.periodsAhead} updates</div>
          <div className="num text-2xl font-bold" style={{ color: "var(--color-accent)" }}>{forecast.projectedPoints}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="kicker">Confidence</div>
          <div className="text-sm font-semibold">{CONF[forecast.confidence]}</div>
        </div>
      </div>

      <p className="mt-3 text-sm text-[var(--color-muted)]">{forecast.trajectory}</p>

      <div className="mt-3 flex items-start gap-2 border-t border-[var(--color-border)] pt-3">
        <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: RISK[forecast.risk.level] }} />
        <div className="text-xs">
          <span className="font-semibold" style={{ color: RISK[forecast.risk.level] }}>Regression risk: {forecast.risk.level}</span>
          <span className="text-[var(--color-muted)]"> — {forecast.risk.note}</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-[var(--color-muted)]">Projection of published {pointsLabel.toLowerCase()} — a trend estimate, not a guarantee.</p>
    </div>
  );
}

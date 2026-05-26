// Per-discipline performance card for ski athletes — surfaces the
// "GS improving · SL unstable" callouts + development focus from the AI
// engine. Renders below the Performance chart on the athlete detail
// page (admin) and on the athlete's own /me workspace.

import type { DisciplineBreakdown, DevelopmentFocus } from "@/lib/ai/disciplineAnalytics";

const TREND_COLOR: Record<string, string> = {
  improving: "var(--color-accent)",
  stable: "var(--color-muted)",
  declining: "#f87171",
  insufficient_data: "var(--color-muted)",
};
const TREND_LABEL: Record<string, string> = {
  improving: "↓ improving",
  stable: "→ stable",
  declining: "↑ declining",
  insufficient_data: "new",
};

const SEVERITY_COLOR: Record<string, string> = {
  high: "#f87171",
  medium: "#f59e0b",
  low: "var(--color-muted)",
};

export function DisciplineBreakdownCard({
  breakdown,
  focus,
  headline,
}: {
  breakdown: DisciplineBreakdown[];
  focus: DevelopmentFocus[];
  headline: string;
}) {
  if (breakdown.length === 0) {
    return null;
  }
  return (
    <div className="card p-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>
          AI
        </span>
        <h3 className="text-sm font-semibold">Per-discipline analysis</h3>
      </div>
      <p className="mb-4 text-sm font-medium text-[var(--color-fg)]/85">{headline}</p>

      {/* Per-discipline table */}
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <th className="px-3 py-2 font-medium">Discipline</th>
              <th className="px-3 py-2 text-right font-medium">Races</th>
              <th className="px-3 py-2 text-right font-medium">DNF</th>
              <th className="px-3 py-2 text-right font-medium">Avg #</th>
              <th className="px-3 py-2 text-right font-medium">Podium</th>
              <th className="px-3 py-2 text-right font-medium">FIS trend</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((d) => (
              <tr key={d.discipline} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-semibold">{d.label}</td>
                <td className="num px-3 py-2 text-right">{d.totalRaces}</td>
                <td
                  className="num px-3 py-2 text-right"
                  style={{ color: d.dnfPct >= 30 ? "#f87171" : undefined }}
                >
                  {d.dnfCount > 0 ? `${d.dnfPct}%` : "0%"}
                </td>
                <td className="num px-3 py-2 text-right">
                  {d.avgFinish != null ? `#${d.avgFinish}` : "—"}
                </td>
                <td className="num px-3 py-2 text-right">
                  {d.podiumCount > 0 ? `${d.podiumCount} (${d.podiumPct}%)` : "—"}
                </td>
                <td className="px-3 py-2 text-right text-xs font-medium" style={{ color: TREND_COLOR[d.fisTrend] }}>
                  {TREND_LABEL[d.fisTrend]}
                  {d.fisDelta != null && d.fisTrend !== "stable" && d.fisTrend !== "insufficient_data" && (
                    <span className="ml-1 text-[10px] text-[var(--color-muted)]">
                      ({d.fisDelta > 0 ? "+" : ""}{d.fisDelta})
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Suggested development focus */}
      {focus.length > 0 && (
        <div className="mt-5 border-t border-[var(--color-border)] pt-4">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            Suggested development focus
          </div>
          <ul className="space-y-2">
            {focus.map((f) => (
              <li
                key={f.area}
                className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: SEVERITY_COLOR[f.severity] }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{f.label}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)]">{f.reason}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

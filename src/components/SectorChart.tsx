import { formatMs } from "@/lib/timingImport";
import { sectorTakeaway, type SessionAnalysis } from "@/lib/timingAnalysis";

// Colour for a sector segment by how far it is from the field's best in that
// sector: green = fastest (or within a whisker), amber = small loss, red = big.
function segColor(t: number, best: number): string {
  if (best <= 0) return "var(--color-surface-2)";
  const d = t - best;
  if (d <= Math.max(8, best * 0.008)) return "var(--color-accent)";
  return d < best * 0.04 ? "#f59e0b" : "#f87171";
}

// Per-athlete stacked sector bar. The whole bar's width is proportional to the
// athlete's total time (so faster = shorter), and each segment within is sized
// by that sector's time. The slowest sector vs the field is outlined.
export function SectorChart({ analysis, highlightAthleteId }: { analysis: SessionAnalysis; highlightAthleteId?: string }) {
  const { leaders, sectorCount } = analysis;
  if (leaders.length === 0) return null;
  const maxFinish = Math.max(...leaders.map((l) => l.finishMs));
  const hasSectors = sectorCount > 1;

  return (
    <div className="space-y-2">
      {hasSectors && (
        <div className="flex items-center gap-3 pb-1 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--color-accent)" }} />miglior settore</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: "#f59e0b" }} />perdita lieve</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: "#f87171" }} />perdita forte</span>
        </div>
      )}
      {leaders.map((l, i) => {
        const me = l.athleteId === highlightAthleteId;
        return (
          <div key={l.athleteId} className={`rounded-lg border px-3 py-2.5 ${me ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5" : "border-[var(--color-border)]"}`}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="num w-5 shrink-0 text-center text-xs text-[var(--color-muted)]">{i + 1}</span>
                <span className="truncate font-medium">{l.name}</span>
                {me && <span className="rounded bg-[var(--color-accent)] px-1.5 text-[9px] font-bold uppercase text-[#0a0c10]">tu</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2 num">
                <span className="font-semibold">{formatMs(l.finishMs)}</span>
                <span className="w-12 text-right text-[11px] text-[var(--color-muted)]">{i === 0 ? "—" : `+${(l.gapMs / 1000).toFixed(2)}`}</span>
              </div>
            </div>

            {hasSectors && (
              <div className="flex h-2.5 gap-[2px]" style={{ width: `${Math.max(18, (l.finishMs / maxFinish) * 100)}%` }}>
                {l.sectors.map((t, j) => {
                  const best = analysis.bestSectors[j] ?? 0;
                  const worst = l.worst && l.worst.sector === j + 1 && l.worst.lossMs > 0;
                  return (
                    <div
                      key={j}
                      className="h-full rounded-[2px]"
                      style={{ flexGrow: t, background: segColor(t, best), outline: worst ? "1.5px solid #f87171" : undefined, outlineOffset: 1 }}
                      title={`Settore ${j + 1}: ${formatMs(t)}${best > 0 ? ` (best ${formatMs(best)})` : ""}`}
                    />
                  );
                })}
              </div>
            )}

            <div className="mt-1 text-[11px] text-[var(--color-muted)]">{sectorTakeaway(l)}</div>
          </div>
        );
      })}
    </div>
  );
}

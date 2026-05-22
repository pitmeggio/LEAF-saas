import type { PerformanceStats } from "@/lib/performance";
import { DISCIPLINE_LABEL } from "@/lib/domain";

function Metric({ label, value, sub, hint, accent }: { label: string; value: string; sub?: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
      <div className="num mt-1 text-3xl font-bold" style={accent ? { color: "var(--color-accent)" } : undefined}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-[var(--color-muted)]">{sub}</div>}
      {hint && <div className="mt-1 text-[11px] italic text-[var(--color-muted)]/80">{hint}</div>}
    </div>
  );
}

function SectionTitle({ kicker, title, right }: { kicker: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>{kicker}</div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      {right}
    </div>
  );
}

// Premium analytics. When `locked`, shows a blurred teaser + unlock message instead of numbers.
export function PerformanceAnalytics({ stats, locked }: { stats: PerformanceStats; locked: boolean }) {
  return (
    <section>
      <SectionTitle
        kicker="Performance analytics"
        title="Advanced stats"
        right={
          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: locked ? "#8a93a61a" : "#7cff6b1a", color: locked ? "#8a93a6" : "#7cff6b" }}>
            {locked ? "Premium" : "Premium · unlocked"}
          </span>
        }
      />

      <div className="relative">
        <div className={locked ? "pointer-events-none select-none blur-sm" : ""}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Races (12 months)" value={String(stats.raceFrequency.last12Months)} sub={`${stats.totalRaces} total`} hint="how active recently" accent />
            <Metric label="Podium rate" value={`${stats.podiumPct}%`} sub={`${stats.podiumCount} of ${stats.finishes} finishes`} hint="finishes in the top 3" />
            <Metric label="Did-not-finish rate" value={`${stats.dnfPct}%`} sub={`${stats.dnfCount} of ${stats.totalRaces} starts`} hint="races not completed (DNF/DSQ)" />
            <Metric label="Consistency" value={stats.consistency.score != null ? `${stats.consistency.score}/100` : "—"} sub={stats.consistency.avgFinish != null ? `avg finish ${stats.consistency.avgFinish}` : undefined} hint="how steady the results are" />
            <Metric label="Best finish" value={stats.bestFinish != null ? `#${stats.bestFinish}` : "—"} hint="highest placing so far" />
            <Metric label="Finishes" value={`${stats.finishes}/${stats.totalRaces}`} sub="completed races" hint="started and finished" />
          </div>

          {/* Discipline split */}
          {stats.disciplineSplit.length > 0 && (
            <div className="card mt-4 p-5">
              <div className="mb-3 text-sm font-semibold">Discipline split</div>
              <div className="space-y-3">
                {stats.disciplineSplit.map((d) => (
                  <div key={d.discipline}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span>{DISCIPLINE_LABEL[d.discipline] ?? d.discipline}</span>
                      <span className="num text-[var(--color-muted)]">{d.count} · {d.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                      <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: "var(--color-accent)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {locked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="card max-w-sm p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-lg">🔒</div>
              <div className="text-sm font-semibold">Premium analytics</div>
              <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                Race frequency, discipline split, consistency, DNF % and podium %.
                Included free for athletes at academies on Leaf.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

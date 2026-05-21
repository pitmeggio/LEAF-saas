// Clean, centered product mock of a verified athlete profile + AI.
// Flat and still — the visual does the talking (Apple-style), no 3D tricks.
export function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-3xl">
      <div className="pointer-events-none absolute -inset-x-16 -top-20 bottom-0 glow-accent opacity-60" />
      <div className="card relative overflow-hidden p-0" style={{ boxShadow: "0 40px 120px -40px rgba(0,0,0,0.8)" }}>
        {/* window bar */}
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
          <span className="num ml-3 text-[11px] text-[var(--color-muted)]">leaf.app/athlete/ingrid-solberg</span>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-[1.1fr_1fr]">
          {/* Identity + stats */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl text-base font-black" style={{ background: "#0ea5e9", color: "#fff" }}>IS</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Ingrid Solberg</span>
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "#7cff6b1a", color: "var(--color-accent)" }}>✓ Verified</span>
                </div>
                <div className="text-xs text-[var(--color-muted)]">🇳🇴 Norway · Alpine skiing · Slalom</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="card-2 p-3">
                <div className="kicker">FIS points</div>
                <div className="num mt-1 text-xl font-bold" style={{ color: "var(--color-accent)" }}>23.1</div>
              </div>
              <div className="card-2 p-3">
                <div className="kicker">World rank</div>
                <div className="num mt-1 text-xl font-bold">#142</div>
              </div>
            </div>
            <div className="card-2 mt-3 p-3">
              <div className="kicker mb-2">Points trend · lower is better</div>
              <svg width="100%" height="40" viewBox="0 0 200 40" preserveAspectRatio="none">
                <polyline points="0,34 30,30 60,31 90,24 120,22 150,16 200,12" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* AI panel */}
          <div className="card-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
              <span className="text-sm font-semibold">Performance insights</span>
            </div>
            <Insight color="var(--color-accent)" mark="▲" title="Upward trajectory" detail="FIS points improving across the season." />
            <Insight color="var(--color-accent)" mark="▲" title="Strong in Slalom" detail="68% of races · best finish 4th." />
            <Insight color="#f59e0b" mark="!" title="Race volume" detail="Add starts to move the ranking." />
            <div className="mt-3 rounded-lg border border-[var(--color-border)] p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-muted)]">Projected · 3 updates</span>
                <span className="num font-bold" style={{ color: "var(--color-accent)" }}>≈ 18.4</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Insight({ color, mark, title, detail }: { color: string; mark: string; title: string; detail: string }) {
  return (
    <div className="mt-2 flex items-start gap-2">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>{mark}</span>
      <div className="leading-tight">
        <div className="text-xs font-semibold">{title}</div>
        <div className="text-[11px] text-[var(--color-muted)]">{detail}</div>
      </div>
    </div>
  );
}

import { prisma } from "@/lib/db";
import { TennisMatchForm, DeleteMatchButton } from "@/components/TennisMatchControls";
import { deriveTennisStats, type SurfaceRecord, type OpponentRecord } from "@/lib/tennisStats";

// Tennis match record + analytics. Server component: pulls the last 24
// matches for the athlete in the active academy, computes stats (W/L,
// recent form, surface breakdown, top opponents) and renders them with a
// compact form to log a new one. No federation data needed.
export async function TennisMatchesPanel({ athleteId, academyId }: { athleteId: string; academyId: string }) {
  const matches = await prisma.tennisMatch.findMany({
    where: { academyId, athleteId },
    orderBy: { date: "desc" },
    take: 24,
  });
  const stats = deriveTennisStats(matches);

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold">Tennis matches</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
            {stats.total === 0
              ? "No matches logged yet."
              : `${stats.total} match${stats.total === 1 ? "" : "es"} · ${stats.wins}W ${stats.losses}L · ${stats.winRate}% win rate`}
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">last 24</span>
      </div>

      <TennisMatchForm athleteId={athleteId} />

      {stats.total > 0 && (
        <>
          {/* Recent form + streak banner */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <RecentFormCard form={stats.recentForm} streak={stats.streak} />
            <SurfaceBreakdownCard surfaces={stats.surfaces} />
          </div>

          {stats.topOpponents.length > 0 && <TopOpponentsCard opponents={stats.topOpponents} />}

          {/* Match list */}
          <div className="mt-4 space-y-1.5">
            {matches.slice(0, 12).map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: m.result === "won" ? "#7CFF6B22" : "#f8717122", color: m.result === "won" ? "var(--color-accent)" : "#f87171" }}
                >
                  {m.result === "won" ? "W" : "L"}
                </span>
                <span className="font-medium">vs {m.opponent}</span>
                {m.score && <span className="num text-xs text-[var(--color-muted)]">{m.score}</span>}
                {m.surface && <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[9px] uppercase text-[var(--color-muted)]">{m.surface}</span>}
                <span className="ml-auto text-[10px] text-[var(--color-muted)]">{new Date(m.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <DeleteMatchButton id={m.id} />
              </div>
            ))}
            {matches.length > 12 && (
              <div className="pt-1 text-center text-[10px] text-[var(--color-muted)]">+{matches.length - 12} earlier match{matches.length - 12 === 1 ? "" : "es"} not shown</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Recent form + streak ──────────────────────────────────────────────────
function RecentFormCard({ form, streak }: { form: ("W" | "L")[]; streak: number }) {
  const streakLabel =
    streak === 0 ? "—" : streak > 0 ? `W${streak}` : `L${Math.abs(streak)}`;
  const streakColor = streak > 0 ? "var(--color-accent)" : streak < 0 ? "#f87171" : "var(--color-muted)";
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Recent form</span>
        <span className="num text-xs font-semibold" style={{ color: streakColor }}>streak {streakLabel}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {form.length === 0 && <span className="text-[11px] text-[var(--color-muted)]">No matches yet.</span>}
        {form.map((r, i) => (
          <span
            key={i}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold"
            style={{
              background: r === "W" ? "#7CFF6B22" : "#f8717122",
              color: r === "W" ? "var(--color-accent)" : "#f87171",
            }}
          >
            {r}
          </span>
        ))}
      </div>
      <div className="mt-1.5 text-[10px] text-[var(--color-muted)]">Oldest → newest (last {form.length})</div>
    </div>
  );
}

// ── Surface breakdown ─────────────────────────────────────────────────────
const SURFACE_LABEL: Record<string, string> = { hard: "Hard", clay: "Clay", grass: "Grass", indoor: "Indoor", unknown: "—" };

function SurfaceBreakdownCard({ surfaces }: { surfaces: SurfaceRecord[] }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Surface breakdown</div>
      <ul className="space-y-1.5">
        {surfaces.map((s) => {
          const total = s.wins + s.losses;
          const winPct = total > 0 ? (s.wins / total) * 100 : 0;
          return (
            <li key={s.surface}>
              <div className="mb-0.5 flex items-baseline justify-between text-[11px]">
                <span>{SURFACE_LABEL[s.surface] ?? s.surface}</span>
                <span className="num text-[var(--color-muted)]">{s.wins}W {s.losses}L · {s.winRate}%</span>
              </div>
              {/* Two-tone bar: green wins portion, red losses portion. */}
              <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--color-surface)]">
                <div className="h-full" style={{ width: `${winPct}%`, background: "var(--color-accent)" }} />
                <div className="h-full" style={{ width: `${100 - winPct}%`, background: "#f87171" }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Top opponents ─────────────────────────────────────────────────────────
function TopOpponentsCard({ opponents }: { opponents: OpponentRecord[] }) {
  return (
    <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Most faced opponents</div>
      <ul className="space-y-1.5 text-sm">
        {opponents.map((o) => {
          const dominant = o.wins > o.losses ? "win" : o.losses > o.wins ? "loss" : "even";
          const color = dominant === "win" ? "var(--color-accent)" : dominant === "loss" ? "#f87171" : "var(--color-muted)";
          return (
            <li key={o.key} className="flex items-center justify-between gap-3">
              <span className="truncate font-medium">{o.opponent}</span>
              <span className="num text-xs">
                <span style={{ color }}>{o.wins}W</span>
                <span className="text-[var(--color-muted)]"> · </span>
                <span style={{ color: o.losses > 0 ? "#f87171" : "var(--color-muted)" }}>{o.losses}L</span>
                <span className="ml-2 text-[10px] text-[var(--color-muted)]">{o.total} meet{o.total === 1 ? "" : "ings"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

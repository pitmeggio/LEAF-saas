import { prisma } from "@/lib/db";
import { TennisMatchForm, DeleteMatchButton } from "@/components/TennisMatchControls";

// Tennis match record + W/L stats. Server component: pulls the last 12
// matches for the athlete in the active academy and renders them with a
// compact form to log a new one. No federation data needed.
export async function TennisMatchesPanel({ athleteId, academyId }: { athleteId: string; academyId: string }) {
  const matches = await prisma.tennisMatch.findMany({
    where: { academyId, athleteId },
    orderBy: { date: "desc" },
    take: 12,
  });
  const wins = matches.filter((m) => m.result === "won").length;
  const total = matches.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold">Tennis matches</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
            {total === 0
              ? "No matches logged yet."
              : `${total} match${total === 1 ? "" : "es"} · ${wins}W ${total - wins}L · ${winRate}% win rate`}
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">last 12</span>
      </div>

      <TennisMatchForm athleteId={athleteId} />

      {matches.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {matches.map((m) => (
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
        </div>
      )}
    </div>
  );
}

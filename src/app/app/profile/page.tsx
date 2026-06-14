import { redirect } from "next/navigation";
import { requireAthleteId } from "@/lib/auth";
import { getAthleteWorkspace } from "@/lib/athleteWorkspace";
import { GrowthChart } from "@/components/GrowthChart";
import { fmtPoints } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profilo — LEAF" };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-2 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="num mt-0.5 text-lg font-bold">{value}</div>
      {sub && <div className="text-[10px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

export default async function AppProfile() {
  const athleteId = await requireAthleteId();
  const w = await getAthleteWorkspace(athleteId);
  if (!w) redirect("/login");
  const perf = w.performance;

  return (
    <div className="px-5 pt-5">
      <div className="mb-4">
        <h1 className="text-xl font-bold">{w.firstName} {w.lastName}</h1>
        <div className="text-xs text-[var(--color-muted)]">
          {w.fisCode ? `FIS ${w.fisCode}` : "Profilo performance"}{w.verified ? " · ✓ verificato" : ""}
        </div>
      </div>

      {/* FIS headline */}
      <div className="card mb-4 grid grid-cols-2 gap-3 p-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Punti FIS</div>
          <div className="num text-2xl font-bold">{fmtPoints(w.fisPoints)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">World rank</div>
          <div className="num text-2xl font-bold">{w.worldRank != null ? `#${w.worldRank}` : "—"}</div>
        </div>
      </div>

      {/* Trend */}
      <div className="card mb-4 p-4">
        <div className="mb-2 text-sm font-semibold">Andamento punti</div>
        {w.pointsEvolution.length > 1 ? (
          <GrowthChart data={w.pointsEvolution} />
        ) : (
          <p className="py-6 text-center text-xs text-[var(--color-muted)]">Storico punti non ancora disponibile.</p>
        )}
      </div>

      {/* Performance stats */}
      {perf ? (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Gare" value={String(perf.totalRaces)} sub={`${perf.raceFrequency.last12Months} ultimi 12m`} />
          <Stat label="Miglior" value={perf.bestFinish != null ? `${perf.bestFinish}°` : "—"} />
          <Stat label="Podi" value={`${Math.round(perf.podiumPct)}%`} />
          <Stat label="DNF" value={`${Math.round(perf.dnfPct)}%`} />
          <Stat label="Costanza" value={perf.consistency.score != null ? `${perf.consistency.score}` : "—"} sub="0–100" />
          <Stat label="Piazz. medio" value={perf.consistency.avgFinish != null ? `${perf.consistency.avgFinish}°` : "—"} />
        </div>
      ) : (
        <div className="card p-4 text-center text-xs text-[var(--color-muted)]">Nessun risultato registrato.</div>
      )}

      {/* Discipline split */}
      {perf && perf.disciplineSplit.length > 0 && (
        <div className="card mb-4 p-4">
          <div className="mb-2 text-sm font-semibold">Discipline</div>
          <div className="space-y-2">
            {perf.disciplineSplit.map((d) => (
              <div key={d.discipline}>
                <div className="mb-0.5 flex items-center justify-between text-[11px]">
                  <span className="uppercase">{d.discipline}</span>
                  <span className="num text-[var(--color-muted)]">{d.count} · {Math.round(d.pct)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                  <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

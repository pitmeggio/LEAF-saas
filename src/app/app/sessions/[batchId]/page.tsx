import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAthleteId } from "@/lib/auth";
import { getSessionForAthlete } from "@/lib/timing";
import { analyzeSession, sectorTakeaway } from "@/lib/timingAnalysis";
import { SectorChart } from "@/components/SectorChart";
import { formatMs } from "@/lib/timingImport";
import { fmtDate } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sessione — LEAF" };

const ord = (n: number) => `${n}°`;

export default async function AppSession({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const athleteId = await requireAthleteId();
  const session = await getSessionForAthlete(batchId, athleteId);
  if (!session) notFound();

  const a = analyzeSession(session.runs);
  const myIdx = a.leaders.findIndex((l) => l.athleteId === athleteId);
  const me = myIdx >= 0 ? a.leaders[myIdx] : null;
  const isDnf = !me && a.dnf.some((d) => d.athleteId === athleteId);

  const meta = [session.discipline, session.location].filter(Boolean).join(" · ");

  return (
    <div className="px-5 pt-5 pb-4">
      <Link href="/app/training" className="text-xs text-[var(--color-muted)]">← Allenamenti</Link>
      <h1 className="mt-2 text-xl font-bold">{session.kind === "race" ? "🏁 Gara" : "🎿 Allenamento"}</h1>
      <p className="mb-4 text-xs text-[var(--color-muted)]">
        {fmtDate(session.date)}{meta ? ` · ${meta}` : ""}{session.sessionLabel ? ` · ${session.sessionLabel}` : ""}
      </p>

      {/* Personal hero */}
      {me ? (
        <div className="card mb-5 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">La tua sessione</div>
          <div className="mt-1 flex items-end gap-3">
            <div className="num text-3xl font-bold" style={{ color: "var(--color-accent)" }}>{ord(myIdx + 1)}</div>
            <div className="pb-1">
              <div className="num text-lg font-bold leading-none">{formatMs(me.finishMs)}</div>
              <div className="text-[11px] text-[var(--color-muted)]">{myIdx === 0 ? "miglior tempo" : `+${(me.gapMs / 1000).toFixed(2)}s dal 1°`} · su {a.leaders.length}</div>
            </div>
          </div>
          <div className="mt-2 rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-xs">{sectorTakeaway(me)}</div>
        </div>
      ) : isDnf ? (
        <div className="card mb-5 p-4 text-sm text-[var(--color-muted)]">Non hai completato questa sessione (DNF/DNS).</div>
      ) : null}

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Classifica & settori</div>
      {a.leaders.length === 0 ? (
        <div className="card p-6 text-center text-sm text-[var(--color-muted)]">Nessun tempo valido.</div>
      ) : (
        <SectorChart analysis={a} highlightAthleteId={athleteId} />
      )}
    </div>
  );
}

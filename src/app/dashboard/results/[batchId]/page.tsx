import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SectorChart } from "@/components/SectorChart";
import { getSession } from "@/lib/auth";
import { getSessionLeaderboard } from "@/lib/timing";
import { analyzeSession } from "@/lib/timingAnalysis";
import { formatMs } from "@/lib/timingImport";
import { fmtDate } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function SessionAnalysisPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const s = await getSession();
  if (!s?.academyId) redirect("/dashboard");

  const session = await getSessionLeaderboard(batchId);
  if (!session) notFound();
  const a = analyzeSession(session.runs);
  const winner = a.leaders[0] ?? null;
  const idealGain = a.idealMs != null && a.winnerMs != null ? a.winnerMs - a.idealMs : null;

  const meta = [
    session.discipline,
    session.location,
    session.sessionLabel,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        title="Analisi sessione"
        subtitle={`${fmtDate(session.date)}${meta ? " · " + meta : ""}`}
        right={
          <Link href="/dashboard/results" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Tempi
          </Link>
        }
      />

      <div className="space-y-6 p-8">
        {/* Headline stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Vincitore" value={winner ? formatMs(winner.finishMs) : "—"} sub={winner?.name} accent />
          <Stat
            label="Run ideale"
            value={a.idealMs != null ? formatMs(a.idealMs) : "—"}
            sub={idealGain != null && idealGain > 0 ? `−${(idealGain / 1000).toFixed(2)}s sul migliore` : "somma dei settori migliori"}
          />
          <Stat label="Atleti" value={String(a.leaders.length)} sub={`${session.runs.length} giri`} />
          <Stat label="Settori" value={a.sectorCount > 1 ? String(a.sectorCount) : "—"} sub={a.sectorCount > 1 ? "con intermedi" : "nessun intermedio"} />
        </div>

        {/* Sector breakdown / leaderboard */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Classifica & settori</h2>
            <span className="text-[11px] text-[var(--color-muted)]">miglior giro di ogni atleta</span>
          </div>
          {a.leaders.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Nessun tempo valido in questa sessione.</p>
          ) : (
            <SectorChart analysis={a} />
          )}
          {a.sectorCount <= 1 && a.leaders.length > 0 && (
            <p className="mt-4 text-[11px] text-[var(--color-muted)]">
              Questa sessione non ha intermedi: l&apos;analisi per settore si attiva quando il file del cronometro include gli Split.
            </p>
          )}
        </div>

        {a.dnf.length > 0 && (
          <div className="text-[11px] text-[var(--color-muted)]">
            DNF/DNS: {a.dnf.map((d) => d.name).join(", ")}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="kicker">{label}</div>
      <div className="num mt-1.5 text-2xl font-bold tracking-tight" style={{ color: accent ? "var(--color-accent)" : undefined }}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

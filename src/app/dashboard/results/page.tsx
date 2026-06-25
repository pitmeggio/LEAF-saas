import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TimingImport } from "@/components/TimingImport";
import { TimingBatchDelete } from "@/components/TimingBatchDelete";
import { getSession } from "@/lib/auth";
import { getAcademyRoster, getRecentTimingSessions } from "@/lib/timing";
import { formatMs } from "@/lib/timingImport";
import { bestPerAthlete } from "@/lib/timingAnalysis";
import { fmtDate } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const s = await getSession();
  if (!s?.academyId) redirect("/dashboard");

  const [athletes, sessions] = await Promise.all([getAcademyRoster(), getRecentTimingSessions()]);

  return (
    <>
      <PageHeader
        title="Tempi & cronometro"
        subtitle="Carica il file del cronometro: LEAF legge i giri e gli intermedi, abbina gli atleti e mette i tempi nei loro profili."
      />
      <div className="space-y-6 p-8">
        <TimingImport athletes={athletes} />

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Sessioni importate</h2>
          {sessions.length === 0 ? (
            <div className="card p-10 text-center text-sm text-[var(--color-muted)]">
              Nessuna sessione ancora. Carica il primo file del cronometro qui sopra.
            </div>
          ) : (
            sessions.map((sess) => {
              const leaders = bestPerAthlete(sess.runs.filter((r) => r.status == null || r.status === ""));
              const runsByAthlete = new Map<string, number>();
              for (const r of sess.runs) runsByAthlete.set(r.athleteId, (runsByAthlete.get(r.athleteId) ?? 0) + 1);
              const best = leaders[0]?.finishMs ?? null;
              return (
                <div key={sess.batchId} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-md bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        {sess.kind === "race" ? "🏁 Gara" : "🎿 Allenamento"}
                      </span>
                      <span className="font-medium">{fmtDate(sess.date)}</span>
                      <span className="text-[var(--color-muted)]">
                        {sess.discipline ? `· ${sess.discipline} ` : ""}{sess.location ? `· ${sess.location} ` : ""}· {sess.runs.length} giri · {leaders.length} atleti
                      </span>
                    </div>
                    <TimingBatchDelete batchId={sess.batchId} />
                  </div>
                  {sess.sessionLabel && <div className="px-4 pt-2 text-[11px] text-[var(--color-muted)]">{sess.sessionLabel}</div>}
                  <table className="w-full text-sm">
                    <thead className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                      <tr>
                        <th className="px-4 py-2 text-left">#</th>
                        <th className="px-2 py-2 text-left">Atleta</th>
                        <th className="px-2 py-2 text-center">Giri</th>
                        <th className="px-4 py-2 text-right">Miglior tempo</th>
                        <th className="px-4 py-2 text-right">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaders.map((r, i) => (
                        <tr key={r.athleteId} className="border-t border-[var(--color-border)]">
                          <td className="px-4 py-1.5 text-[var(--color-muted)]">{i + 1}</td>
                          <td className="px-2 py-1.5">{r.athleteName}</td>
                          <td className="px-2 py-1.5 text-center text-[var(--color-muted)]">{runsByAthlete.get(r.athleteId) ?? 1}</td>
                          <td className="px-4 py-1.5 text-right num font-medium">{formatMs(r.finishMs)}</td>
                          <td className="px-4 py-1.5 text-right num text-[11px] text-[var(--color-muted)]">
                            {i === 0 || best == null || r.finishMs == null ? "—" : `+${((r.finishMs - best) / 1000).toFixed(2)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

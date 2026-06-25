import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TimingImport } from "@/components/TimingImport";
import { TimingBatchDelete } from "@/components/TimingBatchDelete";
import { getSession } from "@/lib/auth";
import { getAcademyRoster, getRecentTimingBatches } from "@/lib/timing";
import { formatMs } from "@/lib/timingImport";
import { fmtDate } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const s = await getSession();
  if (!s?.academyId) redirect("/dashboard");

  const [athletes, batches] = await Promise.all([getAcademyRoster(), getRecentTimingBatches()]);

  return (
    <>
      <PageHeader
        title="Tempi & cronometro"
        subtitle="Carica il file del cronometro: LEAF abbina gli atleti e mette i tempi nei loro profili. Niente più inserimento a mano."
      />
      <div className="space-y-6 p-8">
        <TimingImport athletes={athletes} />

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Sessioni importate</h2>
          {batches.length === 0 ? (
            <div className="card p-10 text-center text-sm text-[var(--color-muted)]">
              Nessuna sessione ancora. Carica il primo file del cronometro qui sopra.
            </div>
          ) : (
            batches.map((b) => (
              <div key={b.batchId} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded-md bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                      {b.kind === "race" ? "🏁 Gara" : "🎿 Allenamento"}
                    </span>
                    <span className="font-medium">{fmtDate(b.date)}</span>
                    <span className="text-[var(--color-muted)]">
                      {b.discipline ? `· ${b.discipline} ` : ""}{b.location ? `· ${b.location} ` : ""}· {b.count} tempi
                    </span>
                  </div>
                  <TimingBatchDelete batchId={b.batchId} />
                </div>
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                    <tr>
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-left">Atleta</th>
                      <th className="px-2 py-2 text-right">R1</th>
                      <th className="px-2 py-2 text-right">R2</th>
                      <th className="px-4 py-2 text-right">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.results.map((r) => (
                      <tr key={r.id} className="border-t border-[var(--color-border)]">
                        <td className="px-4 py-1.5 text-[var(--color-muted)]">{r.rank ?? r.bib ?? "—"}</td>
                        <td className="px-2 py-1.5">{r.athleteName}</td>
                        <td className="px-2 py-1.5 text-right num text-[var(--color-muted)]">{formatMs(r.run1Ms)}</td>
                        <td className="px-2 py-1.5 text-right num text-[var(--color-muted)]">{formatMs(r.run2Ms)}</td>
                        <td className="px-4 py-1.5 text-right num font-medium">{formatMs(r.totalMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

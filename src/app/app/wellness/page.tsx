import { requireAthleteId } from "@/lib/auth";
import { getAthleteWellness } from "@/lib/wellness";
import { WellnessCheckinCard } from "@/components/app/WellnessCheckinCard";
import { readinessBand, BAND_COLOR } from "@/lib/wellnessCore";

export const dynamic = "force-dynamic";
export const metadata = { title: "Benessere · LEAF" };

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", timeZone: "UTC" });

export default async function WellnessPage() {
  const athleteId = await requireAthleteId();
  const w = await getAthleteWellness(athleteId);

  return (
    <div className="px-4 pt-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Benessere</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Un check-in di 20 secondi al giorno. Il tuo staff vede la prontezza e adatta gli allenamenti.
          {w.streak > 1 && <span className="ml-1 text-[var(--color-accent)]">🔥 {w.streak} giorni di fila</span>}
        </p>
      </header>

      <WellnessCheckinCard today={w.today} />

      {/* 14-day readiness trend */}
      {w.history.length >= 2 && (
        <div className="mt-5 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
          <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">Andamento prontezza · 14 giorni</div>
          <div className="flex items-end gap-1.5" style={{ height: 100 }}>
            {w.history.map((h) => {
              const band = readinessBand(h.readiness);
              return (
                <div key={h.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-end justify-center" style={{ height: 80 }}>
                    <div className="w-full max-w-[18px] rounded-t-md" style={{ height: `${Math.max(6, h.readiness)}%`, background: BAND_COLOR[band] }} title={`${h.readiness}`} />
                  </div>
                  <span className="text-[8px] text-[var(--color-muted)]">{dayLabel(h.date).split(" ")[1]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

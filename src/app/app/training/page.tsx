import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAthleteId } from "@/lib/auth";
import { getAthleteWorkspace } from "@/lib/athleteWorkspace";
import { getCalendarEvents } from "@/lib/calendar";
import { getAthletePrograms } from "@/lib/programs";
import { getAthleteSessions } from "@/lib/timing";
import { formatMs } from "@/lib/timingImport";
import { programKindLabel } from "@/lib/trainingProgram";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const metadata = { title: "Allenamenti — LEAF" };

const EVENT_ICON: Record<string, string> = { training: "🎿", camp: "🏔", race: "🏁", travel: "✈️", meeting: "💬", off: "🌙" };

export default async function AppTraining() {
  const athleteId = await requireAthleteId();
  const w = await getAthleteWorkspace(athleteId);
  if (!w) redirect("/login");

  const enr = await prisma.enrollment.findFirst({ where: { athleteId }, select: { academyId: true } });
  const [events, programs, sessions] = await Promise.all([
    enr ? getCalendarEvents({ kind: "athlete", academyId: enr.academyId, athleteId }, { upcomingOnly: true }) : Promise.resolve([]),
    getAthletePrograms(athleteId),
    getAthleteSessions(athleteId),
  ]);

  return (
    <div className="px-5 pt-5">
      <h1 className="mb-1 text-xl font-bold">Allenamenti</h1>
      <p className="mb-4 text-xs text-[var(--color-muted)]">Programmi e sessioni pubblicati dal tuo coach.</p>

      {/* Published programmes from the coach */}
      {programs.length > 0 && (
        <div className="mb-5 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Programmi del coach</div>
          {programs.map((p) => (
            <Link key={p.id} href={`/app/programs/${p.id}`} className="card card-hover flex items-center gap-3 p-4">
              <span className="text-xl" aria-hidden>{p.kind === "race" ? "🏁" : "🎿"}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.title || p.place || programKindLabel(p.kind)}</div>
                <div className="text-[11px] text-[var(--color-muted)]">{fmtDate(p.date)}{p.discipline ? ` · ${p.discipline}` : ""}</div>
              </div>
              <span className="text-[var(--color-accent)]">→</span>
            </Link>
          ))}
        </div>
      )}

      {/* Your timed sessions — tap to see your rank + where you lost */}
      {sessions.length > 0 && (
        <div className="mb-5 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">I tuoi tempi</div>
          {sessions.map((s) => (
            <Link key={s.batchId} href={`/app/sessions/${s.batchId}`} className="card card-hover flex items-center gap-3 p-4">
              <span className="text-xl" aria-hidden>{s.kind === "race" ? "🏁" : "⏱"}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {s.bestMs != null ? formatMs(s.bestMs) : "—"}
                  <span className="ml-2 text-[11px] font-normal text-[var(--color-muted)]">{s.runs} giri</span>
                </div>
                <div className="text-[11px] text-[var(--color-muted)]">{fmtDate(s.date)}{s.discipline ? ` · ${s.discipline}` : ""}{s.location ? ` · ${s.location}` : ""}</div>
              </div>
              <span className="text-[var(--color-accent)]">→</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">Calendario</div>

      {events.length === 0 ? (
        <div className="card p-6 text-center text-sm text-[var(--color-muted)]">Nessun allenamento in programma.</div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="card flex items-start gap-3 p-4">
              <span className="text-xl" aria-hidden>{EVENT_ICON[e.type] ?? "📌"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{e.title}</span>
                  <span className="rounded-md bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--color-muted)]">{e.type}</span>
                </div>
                <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {fmtDate(e.startDate)}{e.endDate ? ` → ${fmtDate(e.endDate)}` : ""}{e.location ? ` · ${e.location}` : ""}
                </div>
                {e.discipline && <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{e.discipline}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

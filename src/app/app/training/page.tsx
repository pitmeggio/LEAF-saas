import { redirect } from "next/navigation";
import { requireAthleteId } from "@/lib/auth";
import { getAthleteWorkspace } from "@/lib/athleteWorkspace";
import { getCalendarEvents } from "@/lib/calendar";
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
  const events = enr
    ? await getCalendarEvents({ kind: "athlete", academyId: enr.academyId, athleteId }, { upcomingOnly: true })
    : [];

  return (
    <div className="px-5 pt-5">
      <h1 className="mb-1 text-xl font-bold">Allenamenti</h1>
      <p className="mb-4 text-xs text-[var(--color-muted)]">Camp, gare e sessioni programmate dal tuo coach.</p>

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

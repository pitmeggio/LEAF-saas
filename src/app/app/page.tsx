import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAthleteId } from "@/lib/auth";
import { getAthleteWorkspace } from "@/lib/athleteWorkspace";
import { getCalendarEvents } from "@/lib/calendar";
import { getLatestPublishedProgram } from "@/lib/programs";
import { getAthleteSessions } from "@/lib/timing";
import { formatMs } from "@/lib/timingImport";
import { programKindLabel } from "@/lib/trainingProgram";
import { prisma } from "@/lib/db";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProgramPop } from "@/components/app/ProgramPop";
import { fmtPoints, fmtDate } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const metadata = { title: "LEAF" };

const EVENT_ICON: Record<string, string> = { training: "🎿", camp: "🏔", race: "🏁", travel: "✈️", meeting: "💬", off: "🌙" };

export default async function AppHome() {
  const athleteId = await requireAthleteId();
  const w = await getAthleteWorkspace(athleteId);
  if (!w) redirect("/login");

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { seasonGoals: true, developmentGoals: true },
  });
  const goals = athlete?.seasonGoals?.trim() || athlete?.developmentGoals?.trim() || null;

  const enr = await prisma.enrollment.findFirst({ where: { athleteId }, select: { academyId: true } });
  const upcoming = enr
    ? (await getCalendarEvents({ kind: "athlete", academyId: enr.academyId, athleteId }, { upcomingOnly: true })).slice(0, 3)
    : [];
  const latestProgram = await getLatestPublishedProgram(athleteId);
  const lastSession = (await getAthleteSessions(athleteId, 1))[0] ?? null;

  const initials = `${w.firstName[0] ?? ""}${w.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="px-5 pt-5">
      {/* Greeting + theme toggle */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-[#0a0c10]" style={{ background: w.photoColor || "#7cff6b" }}>
            {initials}
          </div>
          <div className="leading-tight">
            <div className="text-[11px] text-[var(--color-muted)]">Ciao</div>
            <div className="text-lg font-bold">{w.firstName}</div>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Coach published a programme → pop */}
      {latestProgram && (
        <ProgramPop
          id={latestProgram.id}
          dateLabel={fmtDate(latestProgram.date)}
          kindLabel={programKindLabel(latestProgram.kind)}
          coachName={latestProgram.coachName}
        />
      )}

      {/* Academy card */}
      {w.enrolledAcademy ? (
        <div className="card mb-4 p-4">
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">La tua academy</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.enrolledAcademy.logoColor || "#7cff6b" }} />
            <span className="text-base font-semibold">{w.enrolledAcademy.name}</span>
          </div>
          <div className="mt-1 text-xs text-[var(--color-muted)]">
            {w.groupName ? `${w.groupName}` : "Nessun gruppo"}{w.coachName ? ` · coach ${w.coachName}` : ""}
          </div>
        </div>
      ) : (
        <div className="card mb-4 p-4 text-sm text-[var(--color-muted)]">Non sei ancora collegato a un&apos;academy.</div>
      )}

      {/* Last timed session → tap to see rank + where you lost */}
      {lastSession && (
        <Link href={`/app/sessions/${lastSession.batchId}`} className="card card-hover mb-4 flex items-center justify-between p-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Ultima sessione{lastSession.discipline ? ` · ${lastSession.discipline}` : ""}</div>
            <div className="num text-2xl font-bold">{lastSession.bestMs != null ? formatMs(lastSession.bestMs) : "—"}</div>
            <div className="text-[11px] text-[var(--color-muted)]">{fmtDate(lastSession.date)} · classifica &amp; settori</div>
          </div>
          <span className="shrink-0 text-sm text-[var(--color-accent)]">Dove hai perso →</span>
        </Link>
      )}

      {/* Objectives from the coach */}
      <div className="card mb-4 p-4">
        <div className="mb-1 flex items-center gap-2">
          <span aria-hidden>🎯</span>
          <div className="text-sm font-semibold">Obiettivi</div>
        </div>
        {goals ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-fg)]/85">{goals}</p>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">Il tuo coach non ha ancora impostato gli obiettivi della stagione.</p>
        )}
      </div>

      {/* Next training / events */}
      <div className="card mb-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="text-sm font-semibold">Prossimi allenamenti</div>
          <Link href="/app/training" className="text-xs text-[var(--color-accent)]">Tutti →</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="px-4 py-5 text-center text-xs text-[var(--color-muted)]">Nessun allenamento in programma.</div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg" aria-hidden>{EVENT_ICON[e.type] ?? "📌"}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="text-[11px] text-[var(--color-muted)]">{fmtDate(e.startDate)}{e.location ? ` · ${e.location}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FIS snapshot */}
      {w.sport === "ski" && (
        <Link href="/app/profile" className="card card-hover mb-4 flex items-center justify-between p-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Punti FIS</div>
            <div className="num text-2xl font-bold">{fmtPoints(w.fisPoints)}</div>
            <div className="text-[11px] text-[var(--color-muted)]">{w.worldRank != null ? `World rank #${w.worldRank}` : "—"}</div>
          </div>
          <span className="text-[var(--color-accent)]">Profilo →</span>
        </Link>
      )}
    </div>
  );
}

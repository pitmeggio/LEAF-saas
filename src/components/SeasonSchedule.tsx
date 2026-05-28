// Month-by-month readable schedule — Max's Excel translated into a
// scrollable list. Pure server-side component. No interactivity needed;
// the goal is "open the page, read what Tommaso is doing in March without
// thinking".

const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const CAT_LABEL: Record<string, string> = {
  ITF: "ITF",
  OPEN: "Open",
  ETA: "ETA",
  RODEO: "Rodeo",
  RODEO_OPEN: "Rodeo Open",
  CAT_2: "2ª Cat.",
  CAT_3: "3ª Cat.",
  CAT_4: "4ª Cat.",
  CAT_2_3: "2ª/3ª Cat.",
  CAT_3_4: "3ª/4ª Cat.",
  TEAM: "Squadre",
  TEAM_D1: "Squadre D1",
  YOUTH: "Youth",
  U12_14: "U12/14",
  ALT: "Alternativa",
};

const CAT_COLOR: Record<string, string> = {
  ITF: "#7cff6b", OPEN: "#7cff6b", ETA: "#7cff6b",
  RODEO_OPEN: "#38bdf8", RODEO: "#38bdf8",
  CAT_2: "#a78bfa", CAT_2_3: "#a78bfa", CAT_3: "#a78bfa", CAT_3_4: "#a78bfa", CAT_4: "#a78bfa",
  YOUTH: "#fb7185", U12_14: "#fb7185",
  TEAM: "#facc15", TEAM_D1: "#facc15",
  ALT: "#94a3b8",
};

const PHASE_TINT: Record<string, string> = {
  "Preparazione Invernale": "rgba(163,179,255,0.15)",
  "TEST": "rgba(103,232,249,0.18)",
  "Consolidamento": "rgba(124,255,107,0.15)",
  "Mantenimento": "rgba(250,204,21,0.15)",
  "Mantenimento ": "rgba(250,204,21,0.15)",
  "Recovery": "rgba(251,113,133,0.15)",
};

export type ScheduleEntry = {
  id: string;
  weekStart: Date;
  monthIdx: number;
  trainingPhase: string | null;
  columnKey: string;
  tournamentName: string | null;
  freeText: string | null;
  location: string | null;
  status: string;
};

export function SeasonSchedule({ entries, season, accent }: { entries: ScheduleEntry[]; season: string; accent: string }) {
  // Group by month → week number within month.
  // Each row in the rendered list = one (month, week) bucket.
  type WeekRow = {
    weekStart: Date;
    weekNumInMonth: number;
    phase: string | null;
    dateRange: string;
    events: { id: string; columnKey: string; name: string; location: string | null; status: string }[];
  };

  const byMonth = new Map<number, WeekRow[]>();
  for (const e of entries) {
    const m = e.weekStart.getUTCMonth();
    const dayOfMonth = e.weekStart.getUTCDate();
    const weekN = Math.floor((dayOfMonth - 1) / 7) + 1;
    const arr = byMonth.get(m) ?? [];
    let row = arr.find((r) => r.weekNumInMonth === weekN);
    if (!row) {
      const end = new Date(e.weekStart);
      end.setUTCDate(end.getUTCDate() + 6);
      const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      row = {
        weekStart: e.weekStart,
        weekNumInMonth: weekN,
        phase: e.trainingPhase,
        dateRange: `${fmt(e.weekStart)}–${fmt(end)}`,
        events: [],
      };
      arr.push(row);
    }
    if (e.trainingPhase && !row.phase) row.phase = e.trainingPhase;
    row.events.push({
      id: e.id,
      columnKey: e.columnKey,
      name: e.tournamentName ?? e.freeText ?? "—",
      location: e.location,
      status: e.status,
    });
    arr.sort((a, b) => a.weekNumInMonth - b.weekNumInMonth);
    byMonth.set(m, arr);
  }

  const months = [...byMonth.keys()].sort((a, b) => a - b);
  if (months.length === 0) return null;

  return (
    <div className="space-y-8">
      {months.map((mIdx) => {
        const weeks = byMonth.get(mIdx) ?? [];
        const monthLabel = MONTHS_IT[mIdx];
        // Dominant phase of this month (most common across rows).
        const phaseCounts: Record<string, number> = {};
        for (const w of weeks) if (w.phase) phaseCounts[w.phase] = (phaseCounts[w.phase] ?? 0) + 1;
        const dominantPhase = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        return (
          <article key={mIdx} className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 backdrop-blur-sm">
            {/* Month header */}
            <header className="flex items-baseline justify-between gap-4 border-b border-[var(--color-border)] px-6 py-4">
              <div className="flex items-baseline gap-3">
                <h3 className="text-2xl font-bold tracking-tight">{monthLabel}</h3>
                <span className="text-sm text-[var(--color-muted)]">{season}</span>
              </div>
              {dominantPhase && (
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-wider"
                  style={{
                    background: PHASE_TINT[dominantPhase] ?? "rgba(148,163,184,0.15)",
                    color: dominantPhase.includes("Preparazione")
                      ? "#a3b3ff"
                      : dominantPhase.includes("TEST")
                        ? "#67e8f9"
                        : dominantPhase.includes("Consolidamento")
                          ? "#7cff6b"
                          : dominantPhase.includes("Mantenimento")
                            ? "#facc15"
                            : "#fb7185",
                  }}
                >
                  {dominantPhase.trim()}
                </span>
              )}
            </header>

            {/* Weeks */}
            <div className="divide-y divide-[var(--color-border)]">
              {[1, 2, 3, 4, 5].map((wN) => {
                const row = weeks.find((w) => w.weekNumInMonth === wN);
                const empty = !row || row.events.length === 0;
                return (
                  <div
                    key={wN}
                    className="grid grid-cols-12 gap-3 px-6 py-3 transition-colors hover:bg-[var(--color-surface-2)]/30"
                    style={
                      row?.phase
                        ? { borderLeft: `2px solid transparent`, boxShadow: "inset 3px 0 0 0 transparent" }
                        : undefined
                    }
                  >
                    {/* Week number */}
                    <div className="col-span-1 flex items-center">
                      <span className="num text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                        W{wN}
                      </span>
                    </div>

                    {/* Date range */}
                    <div className="col-span-2 flex items-center text-xs text-[var(--color-muted)]">
                      {row?.dateRange ?? "—"}
                    </div>

                    {/* Events list (right side, takes most space) */}
                    <div className="col-span-9">
                      {empty ? (
                        <span className="text-xs italic text-[var(--color-muted)]/60">
                          {row?.phase ? "Solo allenamento" : "—"}
                        </span>
                      ) : (
                        <div className="space-y-1.5">
                          {row!.events.map((e) => {
                            const color = CAT_COLOR[e.columnKey] ?? "#94a3b8";
                            return (
                              <div key={e.id} className="flex items-baseline gap-3">
                                <span
                                  className="inline-flex h-5 min-w-[3.5rem] items-center justify-center rounded-full border px-1.5 text-[9px] font-bold uppercase tracking-wider"
                                  style={{ borderColor: `${color}55`, background: `${color}15`, color }}
                                >
                                  {CAT_LABEL[e.columnKey] ?? e.columnKey}
                                </span>
                                <span className={`text-sm leading-tight ${e.status === "withdrawn" ? "line-through opacity-50" : ""}`}>
                                  {e.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

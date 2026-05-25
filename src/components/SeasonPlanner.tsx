"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/app/calendar-actions";
import { eventCoversDay, eventTotalCost, seasonKpis, seasonHints, isoWeekNumber, type EventLite } from "@/lib/planning";

export type GroupOpt = { id: string; name: string; budget: number | null; used: number };

// ── Event types (color + label) ─────────────────────────────────────────────
const TYPES = [
  { v: "training", label: "Training", color: "#7CFF6B" },
  { v: "camp",     label: "Camp",     color: "#38bdf8" },
  { v: "race",     label: "Race",     color: "#f59e0b" },
  { v: "travel",   label: "Travel",   color: "#a78bfa" },
  { v: "meeting",  label: "Meeting",  color: "#94a3b8" },
  { v: "off",      label: "Off",      color: "#475569" },
  { v: "other",    label: "Other",    color: "#94a3b8" },
];
const TYPE_COLOR = Object.fromEntries(TYPES.map((t) => [t.v, t.color]));
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.v, t.label]));

const SEASONS = [
  { v: "all", label: "All season" }, { v: "summer", label: "Summer" }, { v: "autumn", label: "Autumn" },
  { v: "winter", label: "Winter" }, { v: "spring", label: "Spring" },
];

const COST_FIELDS: { key: keyof EventLite; label: string }[] = [
  { key: "costHotel", label: "Hotel" },
  { key: "costFlights", label: "Flights" },
  { key: "costVan", label: "Van" },
  { key: "costFuel", label: "Fuel" },
  { key: "costLiftPass", label: "Lift pass" },
  { key: "costCoach", label: "Coach" },
  { key: "costAccommodation", label: "Accommodation" },
  { key: "costRaceFees", label: "Race fees" },
  { key: "costMisc", label: "Misc" },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

function fmtMoney(n: number, currency: string): string {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " ";
  return `${sym}${Math.round(n).toLocaleString("en-US")}`;
}

// Week starts on Monday → days since Monday (0=Mon … 6=Sun).
function dayOfWeekMon0(d: Date): number {
  const js = d.getDay(); // 0=Sun … 6=Sat
  return (js + 6) % 7;
}
function startOfWeek(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - dayOfWeekMon0(x));
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type ViewMode = "year" | "month" | "week";

export function SeasonPlanner({ events, groups, currency, totalBudget, spent, canCreateAcademyWide, initialCursor, initialSeasonFilter }: {
  events: EventLite[];
  groups: GroupOpt[];
  currency: string;
  totalBudget: number;
  spent: number;
  canCreateAcademyWide: boolean;
  // Anchor the cursor to a specific date (e.g. the start of the active season)
  // — falls back to "today" so the existing public-page behaviour is preserved.
  initialCursor?: Date;
  initialSeasonFilter?: string;
}) {
  const now = useMemo(() => new Date(), []);
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(() => initialCursor ?? now); // any date inside the focused period
  const [groupFilter, setGroupFilter] = useState<string>(""); // "" = all, "_academy" = academy-wide, id = team
  const [seasonFilter, setSeasonFilter] = useState<string>(initialSeasonFilter ?? "all");
  const [editing, setEditing] = useState<EventLite | "new" | { prefillDay: Date } | null>(null);

  // Filtered events drive both the views and the KPIs.
  const filteredEvents = useMemo(() => events.filter((e) =>
    (seasonFilter === "all" || e.season === seasonFilter || e.season === "all") &&
    (!groupFilter || (groupFilter === "_academy" ? !e.groupId : e.groupId === groupFilter)),
  ), [events, seasonFilter, groupFilter]);

  // KPIs reflect the selected scope (single team vs whole academy).
  const scope = useMemo(() => {
    if (groupFilter && groupFilter !== "_academy") {
      const g = groups.find((x) => x.id === groupFilter);
      return { totalBudget: g?.budget ?? 0, spent: g?.used ?? 0, label: g?.name ?? "Team" };
    }
    return { totalBudget, spent, label: groupFilter === "_academy" ? "Academy-wide" : "All teams" };
  }, [groupFilter, groups, totalBudget, spent]);

  const kpis = useMemo(() => seasonKpis({ totalBudget: scope.totalBudget, spent: scope.spent, events: filteredEvents, now }), [filteredEvents, scope, now]);
  const hints = useMemo(() => seasonHints(kpis, (n) => fmtMoney(n, currency)), [kpis, currency]);

  const navLabel = useMemo(() => {
    if (view === "year") return String(cursor.getFullYear());
    if (view === "month") return cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const ws = startOfWeek(cursor); const we = addDays(ws, 6);
    const wk = isoWeekNumber(ws);
    return `Week ${wk} · ${ws.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${we.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
  }, [view, cursor]);

  const goPrev = () => {
    const d = new Date(cursor);
    if (view === "year") d.setFullYear(d.getFullYear() - 1);
    else if (view === "month") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCursor(d);
  };
  const goNext = () => {
    const d = new Date(cursor);
    if (view === "year") d.setFullYear(d.getFullYear() + 1);
    else if (view === "month") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCursor(d);
  };

  return (
    <div className="space-y-5">
      {/* KPI bar — adapts to the selected scope (team vs all teams) */}
      <div className="flex items-center justify-between">
        <div>
          <div className="kicker">Scope</div>
          <div className="display text-lg font-semibold">{scope.label}</div>
        </div>
        <div className="text-xs text-[var(--color-muted)]">{filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"} shown</div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Total budget" value={fmtMoney(kpis.totalBudget, currency)} hint={scope.label.toLowerCase()} />
        <Kpi label="Spent" value={fmtMoney(kpis.spent, currency)} hint="approved" />
        <Kpi label="Remaining" value={fmtMoney(kpis.remaining, currency)} danger={kpis.remaining < 0} hint="budget left" />
        <Kpi label="Forecasted" value={fmtMoney(kpis.forecasted, currency)} hint="upcoming events" accent />
        <Kpi label="Travel (30d)" value={fmtMoney(kpis.upcomingTravel, currency)} hint="camps / races / travel" />
        <Kpi label="Budget risk" value={`${kpis.budgetRiskPct}%`} danger={kpis.budgetRiskPct >= 100} hint="forecast vs remaining" />
      </div>

      {hints.length > 0 && (
        <div className="space-y-2">
          {hints.map((h, i) => (
            <div key={i} className="card flex items-start gap-3 p-3 text-sm" style={{ borderColor: h.kind === "warn" ? "#f87171" : undefined }}>
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold" style={{ background: h.kind === "warn" ? "#f87171" : "var(--color-accent)", color: "#0a0c10" }}>AI</span>
              <span className="leading-relaxed">{h.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top toolbar — Apple-style view switcher, scope + filters, new event */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Team</label>
            <select className={inp} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="">All teams</option>
              <option value="_academy">Academy-wide only</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Season</label>
            <select className={inp} value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
              {SEASONS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5">
            <ViewTab active={view === "year"} onClick={() => setView("year")}>Year</ViewTab>
            <ViewTab active={view === "month"} onClick={() => setView("month")}>Month</ViewTab>
            <ViewTab active={view === "week"} onClick={() => setView("week")}>Week</ViewTab>
          </div>
          <button onClick={() => setEditing("new")} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
            + New event
          </button>
        </div>
      </div>

      {/* Period navigator */}
      <div className="flex items-center justify-between">
        <h2 className="display text-2xl font-bold">{navLabel}</h2>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5">
          <button onClick={goPrev} className="rounded-md px-2.5 py-1 text-sm hover:bg-[var(--color-surface)]" aria-label="Previous">‹</button>
          <button onClick={() => setCursor(new Date())} className="rounded-md px-2.5 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface)]">Today</button>
          <button onClick={goNext} className="rounded-md px-2.5 py-1 text-sm hover:bg-[var(--color-surface)]" aria-label="Next">›</button>
        </div>
      </div>

      {/* Body */}
      {view === "year" && <YearView year={cursor.getFullYear()} events={filteredEvents} now={now} onPickMonth={(m) => { setCursor(new Date(cursor.getFullYear(), m, 1)); setView("month"); }} />}
      {view === "month" && <MonthView cursor={cursor} events={filteredEvents} now={now} onPickDay={(d) => setEditing({ prefillDay: d })} onPickEvent={(e) => setEditing(e)} />}
      {view === "week" && <WeekView cursor={cursor} events={filteredEvents} now={now} groups={groups} currency={currency} onPickDay={(d) => setEditing({ prefillDay: d })} onPickEvent={(e) => setEditing(e)} />}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
        {TYPES.map((t) => (
          <span key={t.v} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />{t.label}</span>
        ))}
      </div>

      {editing && (
        <EventModal
          initial={editing === "new" || (typeof editing === "object" && "prefillDay" in editing) ? null : (editing as EventLite)}
          prefillDay={typeof editing === "object" && editing && "prefillDay" in editing ? (editing as { prefillDay: Date }).prefillDay : null}
          groups={groups}
          currency={currency}
          canCreateAcademyWide={canCreateAcademyWide}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${active ? "bg-[var(--color-accent)] text-[#0a0c10]" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}>
      {children}
    </button>
  );
}

function Kpi({ label, value, hint, accent, danger }: { label: string; value: string; hint?: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="card-2 relative p-4">
      {accent && <span className="absolute inset-x-0 top-0 h-[2px] rounded-t-[12px]" style={{ background: "var(--color-accent)", opacity: 0.85 }} />}
      <div className="kicker">{label}</div>
      <div className="num mt-1 text-xl font-bold" style={danger ? { color: "#f87171" } : accent ? { color: "var(--color-accent)" } : undefined}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] capitalize text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}

// ── YEAR VIEW — 12 mini-month grids, days tinted by event coverage ─────────
function YearView({ year, events, now, onPickMonth }: { year: number; events: EventLite[]; now: Date; onPickMonth: (m: number) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => <MiniMonth key={m} year={year} monthIdx={m} events={events} now={now} onPick={() => onPickMonth(m)} />)}
    </div>
  );
}

function MiniMonth({ year, monthIdx, events, now, onPick }: { year: number; monthIdx: number; events: EventLite[]; now: Date; onPick: () => void }) {
  const first = new Date(year, monthIdx, 1);
  const lead = dayOfWeekMon0(first);
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  const last = new Date(year, monthIdx + 1, 0).getDate();
  for (let d = 1; d <= last; d++) cells.push(new Date(year, monthIdx, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <button onClick={onPick} className="card pop p-4 text-left transition-colors hover:border-[var(--color-accent)]">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{MONTH_NAMES[monthIdx]} <span className="text-[var(--color-muted)]">{year}</span></div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
        {WEEKDAY_NAMES.map((w) => <div key={w} className="text-[var(--color-muted)]/60">{w[0]}</div>)}
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const dayEvs = events.filter((e) => eventCoversDay(e, c));
          const isToday = sameDay(c, now);
          const primaryColor = dayEvs[0] ? TYPE_COLOR[dayEvs[0].type] : null;
          return (
            <div key={i} className="relative flex h-7 items-center justify-center rounded-md text-[11px]" style={primaryColor ? { background: `${primaryColor}26`, color: "var(--color-fg)" } : undefined}>
              <span className={isToday ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-[#0a0c10]" : "text-[var(--color-fg)]/90"}>{c.getDate()}</span>
              {dayEvs.length > 1 && <span className="absolute bottom-0.5 right-0.5 h-1 w-1 rounded-full" style={{ background: TYPE_COLOR[dayEvs[1].type] }} />}
            </div>
          );
        })}
      </div>
    </button>
  );
}

// ── MONTH VIEW — Apple-style 6×7 grid with multi-day event bars ────────────
function MonthView({ cursor, events, now, onPickDay, onPickEvent }: {
  cursor: Date; events: EventLite[]; now: Date;
  onPickDay: (d: Date) => void; onPickEvent: (e: EventLite) => void;
}) {
  const year = cursor.getFullYear();
  const monthIdx = cursor.getMonth();
  const first = new Date(year, monthIdx, 1);
  const gridStart = startOfWeek(first);
  const rows: Date[][] = Array.from({ length: 6 }, (_, r) => Array.from({ length: 7 }, (_, c) => addDays(gridStart, r * 7 + c)));

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/60 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
        {WEEKDAY_NAMES.map((w) => <div key={w} className="px-2 py-1.5">{w}</div>)}
      </div>
      <div>
        {rows.map((week, ri) => <MonthWeekRow key={ri} week={week} monthIdx={monthIdx} events={events} now={now} onPickDay={onPickDay} onPickEvent={onPickEvent} />)}
      </div>
    </div>
  );
}

function MonthWeekRow({ week, monthIdx, events, now, onPickDay, onPickEvent }: {
  week: Date[]; monthIdx: number; events: EventLite[]; now: Date;
  onPickDay: (d: Date) => void; onPickEvent: (e: EventLite) => void;
}) {
  // Build event "slices" for this week — one slice per event with a startCol + span.
  const weekStart = week[0]; const weekEnd = week[6];
  type Slice = { event: EventLite; startCol: number; span: number; startsHere: boolean; endsHere: boolean };
  const slices: Slice[] = [];
  for (const e of events) {
    const es = new Date(e.startDate); es.setHours(0, 0, 0, 0);
    const ee = new Date(e.endDate ?? e.startDate); ee.setHours(0, 0, 0, 0);
    if (+ee < +weekStart || +es > +weekEnd) continue;
    const visibleStart = +es < +weekStart ? weekStart : es;
    const visibleEnd = +ee > +weekEnd ? weekEnd : ee;
    const startCol = Math.round((+visibleStart - +weekStart) / 86400000);
    const endCol = Math.round((+visibleEnd - +weekStart) / 86400000);
    slices.push({ event: e, startCol, span: endCol - startCol + 1, startsHere: +es >= +weekStart, endsHere: +ee <= +weekEnd });
  }
  // Lane assignment — first-fit by startCol.
  slices.sort((a, b) => a.startCol - b.startCol || a.event.startDate.localeCompare(b.event.startDate));
  const lanes: Slice[][] = [];
  const slicePlacement = new Map<Slice, number>();
  for (const s of slices) {
    let placed = false;
    for (let li = 0; li < lanes.length; li++) {
      const last = lanes[li][lanes[li].length - 1];
      if (last.startCol + last.span <= s.startCol) { lanes[li].push(s); slicePlacement.set(s, li); placed = true; break; }
    }
    if (!placed) { lanes.push([s]); slicePlacement.set(s, lanes.length - 1); }
  }
  const maxLanes = Math.max(2, lanes.length); // reserve a couple of rows so days don't jump heights
  const ROW_H = 18; // px per event bar lane
  const gridHeight = maxLanes * (ROW_H + 2) + 28; // + cell day number padding

  return (
    <div className="relative grid grid-cols-7 border-b border-[var(--color-border)] last:border-b-0" style={{ minHeight: gridHeight }}>
      {week.map((day, ci) => {
        const isOtherMonth = day.getMonth() !== monthIdx;
        const isToday = sameDay(day, now);
        const wknd = ci >= 5;
        return (
          <button key={ci} onClick={() => onPickDay(day)} className={`relative h-full border-r border-[var(--color-border)] px-1.5 py-1 text-left text-xs last:border-r-0 hover:bg-[var(--color-surface-2)] ${wknd ? "bg-[var(--color-bg)]/40" : ""} ${isOtherMonth ? "opacity-40" : ""}`}>
            <span className={isToday ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-[#0a0c10]" : "text-[var(--color-muted)]"}>{day.getDate()}</span>
          </button>
        );
      })}
      {/* Event bars overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-6 px-0.5">
        {slices.map((s, i) => {
          const lane = slicePlacement.get(s) ?? 0;
          const left = (s.startCol / 7) * 100;
          const width = (s.span / 7) * 100;
          const top = lane * (ROW_H + 2);
          const c = TYPE_COLOR[s.event.type] ?? "#94a3b8";
          return (
            <button
              key={`${s.event.id}-${i}`}
              onClick={(ev) => { ev.stopPropagation(); onPickEvent(s.event); }}
              className="pointer-events-auto absolute flex items-center gap-1 overflow-hidden truncate rounded-md px-1.5 text-[10px] font-medium text-white shadow-sm hover:opacity-90"
              style={{
                left: `calc(${left}% + 2px)`,
                width: `calc(${width}% - 4px)`,
                top,
                height: ROW_H,
                background: c,
                borderTopLeftRadius: s.startsHere ? 6 : 2,
                borderBottomLeftRadius: s.startsHere ? 6 : 2,
                borderTopRightRadius: s.endsHere ? 6 : 2,
                borderBottomRightRadius: s.endsHere ? 6 : 2,
              }}
              title={`${s.event.title}${s.event.location ? " · " + s.event.location : ""}`}
            >
              <span className="truncate">{s.startsHere ? (s.event.location ?? s.event.title) : "↳"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── WEEK VIEW — 7 day cards stacked, full event details per day ────────────
function WeekView({ cursor, events, now, groups, currency, onPickDay, onPickEvent }: {
  cursor: Date; events: EventLite[]; now: Date; groups: GroupOpt[]; currency: string;
  onPickDay: (d: Date) => void; onPickEvent: (e: EventLite) => void;
}) {
  const ws = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const groupNameOf = (id: string | null) => (id ? (groups.find((g) => g.id === id)?.name ?? "—") : "Academy");
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((d) => {
        const dayEvs = events.filter((e) => eventCoversDay(e, d));
        const isToday = sameDay(d, now);
        return (
          <div key={+d} className="card p-3" style={isToday ? { borderColor: "var(--color-accent)" } : undefined}>
            <button onClick={() => onPickDay(d)} className="flex w-full items-baseline justify-between text-left">
              <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{WEEKDAY_NAMES[dayOfWeekMon0(d)]}</span>
              <span className={isToday ? "rounded-md bg-[var(--color-accent)] px-1.5 py-0.5 text-[11px] font-bold text-[#0a0c10]" : "num text-sm font-semibold"}>{d.getDate()}</span>
            </button>
            <div className="mt-2 space-y-1.5">
              {dayEvs.length === 0 && <p className="text-[10px] text-[var(--color-muted)]/60">No events</p>}
              {dayEvs.map((e) => {
                const cost = eventTotalCost(e);
                const c = TYPE_COLOR[e.type] ?? "#94a3b8";
                return (
                  <button key={e.id} onClick={() => onPickEvent(e)} className="block w-full rounded-md border-l-2 bg-[var(--color-surface-2)] px-2 py-1.5 text-left text-[11px] hover:bg-[var(--color-surface)]" style={{ borderColor: c }}>
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="rounded-sm px-1 py-0.5 text-[9px] font-bold uppercase" style={{ background: `${c}22`, color: c }}>{TYPE_LABEL[e.type] ?? e.type}</span>
                      <span className="truncate">{e.location ?? e.title}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{groupNameOf(e.groupId)}{cost > 0 ? ` · ${fmtMoney(cost, currency)}` : ""}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Event editor modal (unchanged behaviour: full cost breakdown) ──────────
function EventModal({ initial, prefillDay, groups, currency, canCreateAcademyWide, onClose }: { initial: EventLite | null; prefillDay: Date | null; groups: GroupOpt[]; currency: string; canCreateAcademyWide: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const toDateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
  const defaultStart = prefillDay ? prefillDay.toISOString().slice(0, 10) : "";
  const [f, set] = useState({
    title: initial?.title ?? "",
    type: initial?.type ?? "training",
    season: initial?.season ?? "all",
    startDate: toDateInput(initial?.startDate ?? null) || defaultStart,
    endDate: toDateInput(initial?.endDate ?? null),
    groupId: initial?.groupId ?? (canCreateAcademyWide ? "" : (groups[0]?.id ?? "")),
    location: initial?.location ?? "",
    planBLocation: initial?.planBLocation ?? "",
    discipline: initial?.discipline ?? "",
    coachesNote: initial?.coachesNote ?? "",
    notes: initial?.notes ?? "",
    costHotel: initial?.costHotel ?? 0,
    costFlights: initial?.costFlights ?? 0,
    costVan: initial?.costVan ?? 0,
    costFuel: initial?.costFuel ?? 0,
    costLiftPass: initial?.costLiftPass ?? 0,
    costCoach: initial?.costCoach ?? 0,
    costAccommodation: initial?.costAccommodation ?? 0,
    costRaceFees: initial?.costRaceFees ?? 0,
    costMisc: initial?.costMisc ?? 0,
    estimatedCost: initial?.estimatedCost ?? null,
    actualCost: initial?.actualCost ?? null,
  });
  const upd = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => set((s) => ({ ...s, [k]: v }));
  const updNum = (k: keyof typeof f, v: string) => set((s) => ({ ...s, [k]: v === "" ? 0 : Number(v) }));
  const breakdownTotal = COST_FIELDS.reduce((s, c) => s + (Number((f as Record<string, unknown>)[c.key as string]) || 0), 0);

  const submit = () => {
    setErr(null);
    start(async () => {
      const payload = {
        title: f.title, type: f.type, season: f.season,
        startDate: f.startDate, endDate: f.endDate || undefined,
        groupId: f.groupId || undefined,
        location: f.location || undefined,
        planBLocation: f.planBLocation || undefined,
        discipline: f.discipline || undefined,
        coachesNote: f.coachesNote || undefined,
        notes: f.notes || undefined,
        costHotel: Number(f.costHotel) || 0, costFlights: Number(f.costFlights) || 0,
        costVan: Number(f.costVan) || 0, costFuel: Number(f.costFuel) || 0,
        costLiftPass: Number(f.costLiftPass) || 0, costCoach: Number(f.costCoach) || 0,
        costAccommodation: Number(f.costAccommodation) || 0, costRaceFees: Number(f.costRaceFees) || 0,
        costMisc: Number(f.costMisc) || 0,
        estimatedCost: f.estimatedCost, actualCost: f.actualCost,
      };
      const r = initial ? await updateCalendarEvent(initial.id, payload) : await createCalendarEvent(payload);
      if (!r.ok) { setErr(r.error ?? "Failed"); return; }
      router.refresh(); onClose();
    });
  };
  const remove = () => {
    if (!initial) return;
    if (!confirm("Delete this event?")) return;
    start(async () => { const r = await deleteCalendarEvent(initial.id); if (r.ok) { router.refresh(); onClose(); } else setErr(r.error ?? "Failed"); });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{initial ? "Edit event" : "New event"}</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">✕</button>
        </div>
        <div className="space-y-3">
          <Field label="Title *"><input className={inp} value={f.title} onChange={(e) => upd("title", e.target.value)} placeholder="e.g. Saas-Fee summer camp" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><select className={inp} value={f.type} onChange={(e) => upd("type", e.target.value)}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></Field>
            <Field label="Season"><select className={inp} value={f.season} onChange={(e) => upd("season", e.target.value)}>{SEASONS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date *"><input type="date" className={inp} value={f.startDate} onChange={(e) => upd("startDate", e.target.value)} /></Field>
            <Field label="End date"><input type="date" className={inp} value={f.endDate} onChange={(e) => upd("endDate", e.target.value)} /></Field>
          </div>
          <Field label="Group">
            <select className={inp} value={f.groupId} onChange={(e) => upd("groupId", e.target.value)}>
              {canCreateAcademyWide && <option value="">Academy-wide</option>}
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plan A — location"><input className={inp} value={f.location} onChange={(e) => upd("location", e.target.value)} placeholder="e.g. Saas-Fee" /></Field>
            <Field label="Plan B — fallback"><input className={inp} value={f.planBLocation} onChange={(e) => upd("planBLocation", e.target.value)} placeholder="e.g. Hintertux" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discipline"><input className={inp} value={f.discipline} onChange={(e) => upd("discipline", e.target.value)} placeholder="GS / SL / SG …" /></Field>
            <Field label="Coaches (free text)"><input className={inp} value={f.coachesNote} onChange={(e) => upd("coachesNote", e.target.value)} placeholder="e.g. Lars, Marit" /></Field>
          </div>
          <Field label="Notes / info"><textarea rows={2} className={`${inp} resize-none`} value={f.notes} onChange={(e) => upd("notes", e.target.value)} placeholder="Free ski · Stubbies · approach to gates …" /></Field>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">Cost breakdown ({currency})</div>
              <div className="num text-xs text-[var(--color-muted)]">Sum: <span className="font-semibold text-[var(--color-fg)]">{fmtMoney(breakdownTotal, currency)}</span></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {COST_FIELDS.map((c) => (
                <div key={c.key as string}>
                  <label className="mb-0.5 block text-[10px] text-[var(--color-muted)]">{c.label}</label>
                  <input type="number" min={0} className={inp} value={(f as Record<string, unknown>)[c.key as string] as number} onChange={(e) => updNum(c.key as keyof typeof f, e.target.value)} />
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label={`Estimated cost (override, ${currency})`}><input type="number" min={0} className={inp} value={f.estimatedCost ?? ""} onChange={(e) => set((s) => ({ ...s, estimatedCost: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="auto = sum" /></Field>
              <Field label={`Actual cost (${currency})`}><input type="number" min={0} className={inp} value={f.actualCost ?? ""} onChange={(e) => set((s) => ({ ...s, actualCost: e.target.value === "" ? null : Number(e.target.value) }))} /></Field>
            </div>
          </div>

          {err && <p className="text-xs text-[#f87171]">{err}</p>}
          <div className="flex items-center justify-between pt-2">
            <div>{initial && <button onClick={remove} disabled={pending} className="text-xs font-medium text-[#f87171] hover:underline">Delete</button>}</div>
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">Cancel</button>
              <button onClick={submit} disabled={pending || !f.title || !f.startDate} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">{label}</label>
      {children}
    </div>
  );
}

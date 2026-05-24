"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/app/calendar-actions";
import { daysOfMonth, isoWeekNumber, eventCoversDay, eventTotalCost, eventBreakdownTotal, seasonKpis, seasonHints, type EventLite } from "@/lib/planning";

export type GroupOpt = { id: string; name: string; budget: number | null };

const TYPES = [
  { v: "training", label: "Training", color: "var(--color-accent)" },
  { v: "camp", label: "Camp", color: "#38bdf8" },
  { v: "race", label: "Race", color: "#f59e0b" },
  { v: "travel", label: "Travel", color: "#a78bfa" },
  { v: "meeting", label: "Meeting", color: "#8a93a6" },
  { v: "off", label: "Off", color: "#475569" },
  { v: "other", label: "Other", color: "#8a93a6" },
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

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

function fmtMoney(n: number, currency: string): string {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " ";
  return `${sym}${Math.round(n).toLocaleString("en-US")}`;
}

export function SeasonPlanner({ events, groups, currency, totalBudget, spent, canCreateAcademyWide }: {
  events: EventLite[];
  groups: GroupOpt[];
  currency: string;
  totalBudget: number;
  spent: number;
  canCreateAcademyWide: boolean;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [editing, setEditing] = useState<EventLite | "new" | { prefillDay: Date } | null>(null);

  const filteredEvents = useMemo(() => events.filter((e) =>
    (seasonFilter === "all" || e.season === seasonFilter || e.season === "all") &&
    (!groupFilter || (groupFilter === "_academy" ? !e.groupId : e.groupId === groupFilter)),
  ), [events, seasonFilter, groupFilter]);

  const days = useMemo(() => daysOfMonth(year, monthIdx), [year, monthIdx]);
  const monthLabel = new Date(year, monthIdx, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const kpis = useMemo(() => seasonKpis({ totalBudget, spent, events: filteredEvents, now }), [filteredEvents, totalBudget, spent, now]);
  const hints = useMemo(() => seasonHints(kpis, (n) => fmtMoney(n, currency)), [kpis, currency]);

  const groupNameOf = (id: string | null) => (id ? (groups.find((g) => g.id === id)?.name ?? "—") : "Academy");

  const goMonth = (delta: number) => {
    let m = monthIdx + delta, y = year;
    if (m < 0) { m = 11; y -= 1; } if (m > 11) { m = 0; y += 1; }
    setMonthIdx(m); setYear(y);
  };

  return (
    <div className="space-y-5">
      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Total budget" value={fmtMoney(kpis.totalBudget, currency)} hint="all groups combined" />
        <Kpi label="Spent" value={fmtMoney(kpis.spent, currency)} hint="approved expenses" />
        <Kpi label="Remaining" value={fmtMoney(kpis.remaining, currency)} danger={kpis.remaining < 0} hint="budget left" />
        <Kpi label="Forecasted" value={fmtMoney(kpis.forecasted, currency)} hint="upcoming events" accent />
        <Kpi label="Travel (30d)" value={fmtMoney(kpis.upcomingTravel, currency)} hint="camps / races / travel" />
        <Kpi label="Budget risk" value={`${kpis.budgetRiskPct}%`} danger={kpis.budgetRiskPct >= 100} hint="forecast vs remaining" />
      </div>

      {/* AI hints */}
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5">
            <button onClick={() => goMonth(-1)} className="rounded-md px-2 py-1 text-sm hover:bg-[var(--color-surface)]" aria-label="Previous month">‹</button>
            <span className="px-3 text-sm font-semibold">{monthLabel}</span>
            <button onClick={() => goMonth(1)} className="rounded-md px-2 py-1 text-sm hover:bg-[var(--color-surface)]" aria-label="Next month">›</button>
            <button onClick={() => { setYear(now.getFullYear()); setMonthIdx(now.getMonth()); }} className="ml-1 rounded-md border-l border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted)]">Today</button>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Group</label>
            <select className={inp} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="">All</option>
              <option value="_academy">Academy-wide</option>
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
        <button onClick={() => setEditing("new")} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
          + New event
        </button>
      </div>

      {/* Spreadsheet planner */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/60 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-2 py-2 text-left font-medium">Wk</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Plan A</th>
              <th className="px-3 py-2 text-left font-medium">Plan B</th>
              <th className="px-3 py-2 text-left font-medium">Disc.</th>
              <th className="px-3 py-2 text-left font-medium">Group</th>
              <th className="px-3 py-2 text-left font-medium">Notes</th>
              <th className="px-3 py-2 text-right font-medium">Est. cost</th>
              <th className="px-3 py-2 text-right font-medium">Actual</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const dayEvents = filteredEvents.filter((e) => eventCoversDay(e, day));
              const wknd = day.getDay() === 0 || day.getDay() === 6;
              const today = day.toDateString() === now.toDateString();
              if (dayEvents.length === 0) {
                return (
                  <tr key={+day} onClick={() => setEditing({ prefillDay: day })} className={`cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)] ${wknd ? "bg-[var(--color-bg)]/40" : ""}`}>
                    <td className="px-3 py-2 text-xs">
                      <span className={today ? "rounded bg-[var(--color-accent)] px-1.5 py-0.5 font-semibold text-[#0a0c10]" : "font-medium"}>{day.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit" })}</span>
                    </td>
                    <td className="num px-2 py-2 text-xs text-[var(--color-muted)]">{isoWeekNumber(day)}</td>
                    <td colSpan={8} className="px-3 py-2 text-xs text-[var(--color-muted)]/60">—</td>
                  </tr>
                );
              }
              return dayEvents.map((e, idx) => {
                const cost = eventTotalCost(e);
                return (
                  <tr key={`${+day}-${e.id}`} onClick={() => setEditing(e)} className={`cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)] ${wknd ? "bg-[var(--color-bg)]/40" : ""}`}>
                    {idx === 0 ? (
                      <>
                        <td className="px-3 py-2 text-xs">
                          <span className={today ? "rounded bg-[var(--color-accent)] px-1.5 py-0.5 font-semibold text-[#0a0c10]" : "font-medium"}>{day.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit" })}</span>
                        </td>
                        <td className="num px-2 py-2 text-xs text-[var(--color-muted)]">{isoWeekNumber(day)}</td>
                      </>
                    ) : (
                      <><td /><td /></>
                    )}
                    <td className="px-3 py-2">
                      <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${TYPE_COLOR[e.type] ?? "#8a93a6"}22`, color: TYPE_COLOR[e.type] ?? "#8a93a6" }}>{TYPE_LABEL[e.type] ?? e.type}</span>
                    </td>
                    <td className="px-3 py-2 font-medium">{e.location ?? <span className="text-[var(--color-muted)]">{e.title}</span>}</td>
                    <td className="px-3 py-2 text-[var(--color-muted)]">{e.planBLocation ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--color-muted)]">{e.discipline ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{groupNameOf(e.groupId)}</td>
                    <td className="px-3 py-2 max-w-[260px] truncate text-xs text-[var(--color-muted)]">{e.notes ?? ""}</td>
                    <td className="num px-3 py-2 text-right text-xs">{cost > 0 ? fmtMoney(cost, currency) : "—"}</td>
                    <td className="num px-3 py-2 text-right text-xs" style={e.actualCost != null && e.estimatedCost != null && e.actualCost > e.estimatedCost ? { color: "#f87171" } : undefined}>{e.actualCost != null ? fmtMoney(e.actualCost, currency) : "—"}</td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EventModal
          initial={editing === "new" ? null : "prefillDay" in (editing as { prefillDay?: Date }) ? null : (editing as EventLite)}
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

function Kpi({ label, value, hint, accent, danger }: { label: string; value: string; hint?: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="card-2 relative p-4">
      {accent && <span className="absolute inset-x-0 top-0 h-[2px] rounded-t-[12px]" style={{ background: "var(--color-accent)", opacity: 0.85 }} />}
      <div className="kicker">{label}</div>
      <div className="num mt-1 text-xl font-bold" style={danger ? { color: "#f87171" } : accent ? { color: "var(--color-accent)" } : undefined}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}

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
        costHotel: Number(f.costHotel) || 0,
        costFlights: Number(f.costFlights) || 0,
        costVan: Number(f.costVan) || 0,
        costFuel: Number(f.costFuel) || 0,
        costLiftPass: Number(f.costLiftPass) || 0,
        costCoach: Number(f.costCoach) || 0,
        costAccommodation: Number(f.costAccommodation) || 0,
        costRaceFees: Number(f.costRaceFees) || 0,
        costMisc: Number(f.costMisc) || 0,
        estimatedCost: f.estimatedCost,
        actualCost: f.actualCost,
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
      <div className="relative w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl max-h-[90vh]">
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

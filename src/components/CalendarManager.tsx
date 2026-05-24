"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/app/calendar-actions";

const TYPES = [
  { v: "training", label: "Training" }, { v: "camp", label: "Camp" }, { v: "race", label: "Race" },
  { v: "travel", label: "Travel" }, { v: "meeting", label: "Meeting" }, { v: "other", label: "Other" },
];
const SEASONS = [
  { v: "all", label: "All season" }, { v: "summer", label: "Summer" }, { v: "autumn", label: "Autumn" },
  { v: "winter", label: "Winter" }, { v: "spring", label: "Spring" },
];
const TYPE_COLOR: Record<string, string> = {
  training: "var(--color-accent)", camp: "#38bdf8", race: "#f59e0b",
  travel: "#a78bfa", meeting: "#8a93a6", other: "#8a93a6",
};

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

export type CalendarEventRow = {
  id: string;
  title: string;
  type: string;
  season: string;
  startDate: string; // ISO
  endDate: string | null;
  location: string | null;
  notes: string | null;
  group: { id: string; name: string } | null;
  coach: { id: string; name: string } | null;
};

export type GroupOpt = { id: string; name: string };

export function CalendarManager({ events, groups, canCreateAcademyWide }: { events: CalendarEventRow[]; groups: GroupOpt[]; canCreateAcademyWide: boolean }) {
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [editing, setEditing] = useState<CalendarEventRow | "new" | null>(null);

  const filtered = useMemo(() => events.filter((e) =>
    (seasonFilter === "all" || e.season === seasonFilter || e.season === "all") &&
    (!groupFilter || (groupFilter === "_academy" ? !e.group : e.group?.id === groupFilter)),
  ), [events, seasonFilter, groupFilter]);

  // Group events by month for a readable list.
  const groupedByMonth = useMemo(() => {
    const m = new Map<string, CalendarEventRow[]>();
    for (const e of filtered) {
      const d = new Date(e.startDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      const entry = m.get(key);
      if (entry) entry.push(e);
      else m.set(key, [e]);
      void label;
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, list]) => ({
      key,
      label: new Date(list[0].startDate).toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      list,
    }));
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Season</label>
            <select className={inp} value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
              {SEASONS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Group</label>
            <select className={inp} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="">All</option>
              <option value="_academy">Academy-wide</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => setEditing("new")} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
          + New event
        </button>
      </div>

      {groupedByMonth.length === 0 && (
        <p className="card p-8 text-center text-sm text-[var(--color-muted)]">No events. Add the first one →</p>
      )}

      {groupedByMonth.map((m) => (
        <div key={m.key}>
          <div className="kicker mb-2">{m.label}</div>
          <div className="card divide-y divide-[var(--color-border)] overflow-hidden">
            {m.list.map((e) => <EventRow key={e.id} ev={e} onEdit={() => setEditing(e)} />)}
          </div>
        </div>
      ))}

      {editing && (
        <EventModal
          initial={editing === "new" ? null : editing}
          groups={groups}
          canCreateAcademyWide={canCreateAcademyWide}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EventRow({ ev, onEdit }: { ev: CalendarEventRow; onEdit: () => void }) {
  const start = new Date(ev.startDate);
  const end = ev.endDate ? new Date(ev.endDate) : null;
  const sameDay = !end || start.toDateString() === end.toDateString();
  const dateLabel = sameDay
    ? start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${end!.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
  return (
    <button onClick={onEdit} className="flex w-full items-start gap-4 px-4 py-3 text-left hover:bg-[var(--color-surface-2)]">
      <div className="w-24 shrink-0 text-xs font-semibold text-[var(--color-fg)]">{dateLabel}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{ev.title}</span>
          <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${TYPE_COLOR[ev.type] ?? "#8a93a6"}22`, color: TYPE_COLOR[ev.type] ?? "#8a93a6" }}>{ev.type}</span>
          {ev.season !== "all" && <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{ev.season}</span>}
        </div>
        <div className="mt-0.5 text-xs text-[var(--color-muted)]">
          {ev.group ? ev.group.name : "Academy-wide"}
          {ev.location ? ` · ${ev.location}` : ""}
          {ev.coach ? ` · ${ev.coach.name}` : ""}
        </div>
      </div>
    </button>
  );
}

function EventModal({ initial, groups, canCreateAcademyWide, onClose }: { initial: CalendarEventRow | null; groups: GroupOpt[]; canCreateAcademyWide: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const toDateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
  const [f, set] = useState({
    title: initial?.title ?? "",
    type: initial?.type ?? "training",
    season: initial?.season ?? "all",
    startDate: toDateInput(initial?.startDate ?? null),
    endDate: toDateInput(initial?.endDate ?? null),
    groupId: initial?.group?.id ?? (canCreateAcademyWide ? "" : (groups[0]?.id ?? "")),
    location: initial?.location ?? "",
    notes: initial?.notes ?? "",
  });
  const upd = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => set((s) => ({ ...s, [k]: v }));

  const submit = () => {
    setErr(null);
    start(async () => {
      const payload = {
        title: f.title, type: f.type, season: f.season,
        startDate: f.startDate, endDate: f.endDate || undefined,
        groupId: f.groupId || undefined, location: f.location || undefined, notes: f.notes || undefined,
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
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{initial ? "Edit event" : "New event"}</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">✕</button>
        </div>
        <div className="space-y-3">
          <Field label="Title *"><input className={inp} value={f.title} onChange={(e) => upd("title", e.target.value)} /></Field>
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
              {canCreateAcademyWide && <option value="">Academy-wide (all groups)</option>}
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Location"><input className={inp} value={f.location} onChange={(e) => upd("location", e.target.value)} placeholder="e.g. Trysil" /></Field>
          <Field label="Notes"><textarea rows={2} className={`${inp} resize-none`} value={f.notes} onChange={(e) => upd("notes", e.target.value)} /></Field>
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

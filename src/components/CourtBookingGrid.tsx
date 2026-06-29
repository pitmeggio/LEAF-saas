"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { createCourtBooking, deleteCourtBooking, deleteCourtSeries } from "@/app/court-actions";
import type { CourtCol, CourtBookingView } from "@/lib/courts";

const DAY_START = 8 * 60;   // 08:00
const DAY_END = 22 * 60;    // 22:00
const SLOT = 30;            // minutes per row
const ROW_H = 26;           // px per slot
const ROWS = (DAY_END - DAY_START) / SLOT;

const TYPES = [
  { key: "lesson", label: "Lezione", color: "var(--color-accent)" },
  { key: "course", label: "Corso", color: "#3b82f6" },
  { key: "member", label: "Socio", color: "#a78bfa" },
  { key: "maintenance", label: "Manut.", color: "#6b7280" },
] as const;
const COLOR: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.key, t.color]));

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const TIME_OPTS: number[] = [];
for (let m = DAY_START; m <= DAY_END; m += SLOT) TIME_OPTS.push(m);

function addDaysISO(iso: string, n: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}
function prettyDay(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export function CourtBookingGrid({
  dateISO, todayISO, courts, bookings, groups,
}: {
  dateISO: string; todayISO: string;
  courts: CourtCol[];
  bookings: CourtBookingView[];
  groups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mounted] = useState(true);
  const [create, setCreate] = useState<{ courtId: string; startMin: number } | null>(null);
  const [edit, setEdit] = useState<CourtBookingView | null>(null);

  const go = (n: number) => router.push(`/dashboard/courts?date=${addDaysISO(dateISO, n)}`);
  const goToday = () => router.push(`/dashboard/courts?date=${todayISO}`);

  const byCourt = new Map<string, CourtBookingView[]>();
  for (const b of bookings) (byCourt.get(b.courtId) ?? byCourt.set(b.courtId, []).get(b.courtId)!).push(b);

  if (courts.length === 0) {
    return <div className="card p-8 text-center text-sm text-[var(--color-muted)]">Aggiungi prima una sede per gestire le prenotazioni.</div>;
  }

  return (
    <div className="card overflow-hidden">
      {/* Day navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => go(-1)} className="rounded-md border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-surface-2)]"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => go(1)} className="rounded-md border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-surface-2)]"><ChevronRight className="h-4 w-4" /></button>
          <span className="ml-1 text-sm font-semibold capitalize">{prettyDay(dateISO)}</span>
          {dateISO !== todayISO && <button onClick={goToday} className="ml-1 text-xs text-[var(--color-accent)] hover:underline">Oggi</button>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-[var(--color-muted)]">
          {TYPES.map((t) => <span key={t.key} className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />{t.label}</span>)}
          <span>· {bookings.length} prenotazioni</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max">
          {/* Time gutter */}
          <div className="sticky left-0 z-10 w-14 shrink-0 bg-[var(--color-surface)]">
            <div className="h-8 border-b border-[var(--color-border)]" />
            <div className="relative" style={{ height: ROWS * ROW_H }}>
              {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => (
                <div key={i} className="absolute right-2 -translate-y-1/2 text-[10px] text-[var(--color-muted)]" style={{ top: i * 60 / SLOT * ROW_H }}>
                  {hhmm(DAY_START + i * 60)}
                </div>
              ))}
            </div>
          </div>

          {/* Court columns */}
          {courts.map((c) => (
            <div key={c.id} className="w-40 shrink-0 border-l border-[var(--color-border)]">
              <div className="flex h-8 items-center justify-center gap-1.5 border-b border-[var(--color-border)] px-2 text-xs font-medium">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.surface === "clay" ? "#d97706" : c.surface === "hard" ? "#3b82f6" : c.surface === "grass" ? "#22c55e" : "#94a3b8" }} />
                <span className="truncate">{c.label}</span>
              </div>
              <div className="relative" style={{ height: ROWS * ROW_H }}>
                {/* clickable empty slots */}
                {Array.from({ length: ROWS }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setCreate({ courtId: c.id, startMin: DAY_START + i * SLOT })}
                    className={`absolute left-0 w-full border-b ${i % 2 === 1 ? "border-[var(--color-border)]/40" : "border-[var(--color-border)]/70"} hover:bg-[var(--color-accent)]/10`}
                    style={{ top: i * ROW_H, height: ROW_H }}
                    aria-label="Prenota slot"
                  />
                ))}
                {/* booking blocks */}
                {(byCourt.get(c.id) ?? []).map((b) => {
                  const top = ((b.startMin - DAY_START) / SLOT) * ROW_H;
                  const h = Math.max(ROW_H - 2, ((b.endMin - b.startMin) / SLOT) * ROW_H - 2);
                  return (
                    <button
                      key={b.id}
                      onClick={() => setEdit(b)}
                      className="absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1.5 py-1 text-left text-[10px] leading-tight text-[#0a0c10]"
                      style={{ top: top + 1, height: h, background: COLOR[b.type] ?? "#6b7280" }}
                      title={`${b.title ?? ""} ${hhmm(b.startMin)}–${hhmm(b.endMin)}`}
                    >
                      <div className="truncate font-semibold">{b.title || b.groupName || TYPES.find((t) => t.key === b.type)?.label}</div>
                      <div className="truncate opacity-80">{hhmm(b.startMin)}–{hhmm(b.endMin)}{b.seriesId ? " · ↻" : ""}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {mounted && create && createPortal(
        <CreateModal
          dateISO={dateISO} courtLabel={courts.find((c) => c.id === create.courtId)?.label ?? ""}
          init={create} groups={groups} pending={pending}
          onClose={() => setCreate(null)}
          onSave={(payload) => start(async () => {
            const r = await createCourtBooking({ ...payload, courtId: create.courtId, dateISO });
            if (r.ok) { setCreate(null); router.refresh(); }
          })}
        />, document.body)}

      {mounted && edit && createPortal(
        <EditModal
          b={edit} pending={pending} onClose={() => setEdit(null)}
          onDelete={() => start(async () => { await deleteCourtBooking(edit.id); setEdit(null); router.refresh(); })}
          onDeleteSeries={() => start(async () => { if (edit.seriesId) await deleteCourtSeries(edit.seriesId); setEdit(null); router.refresh(); })}
        />, document.body)}
    </div>
  );
}

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-[11px] text-[var(--color-muted)]";

function CreateModal({ dateISO, courtLabel, init, groups, pending, onClose, onSave }: {
  dateISO: string; courtLabel: string; init: { startMin: number };
  groups: { id: string; name: string }[]; pending: boolean;
  onClose: () => void;
  onSave: (p: { startMin: number; endMin: number; type: string; title?: string; groupId?: string; repeatWeeks?: number }) => void;
}) {
  const [type, setType] = useState("lesson");
  const [title, setTitle] = useState("");
  const [groupId, setGroupId] = useState("");
  const [startMin, setStartMin] = useState(init.startMin);
  const [endMin, setEndMin] = useState(Math.min(DAY_END, init.startMin + 60));
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState(12);

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card mt-16 w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Prenota · {courtLabel}</h3>
          <button onClick={onClose} className="text-[var(--color-muted)]"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => setType(t.key)} className="flex-1 rounded-md px-2 py-1.5 text-xs font-medium" style={type === t.key ? { background: t.color, color: "#0a0c10" } : { color: "var(--color-muted)" }}>{t.label}</button>
          ))}
        </div>
        <div className="space-y-3">
          <div><label className={lbl}>Titolo / chi</label><input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "course" ? "es. Corso U12" : type === "lesson" ? "es. Lezione Rossi" : "es. Socio Bianchi"} /></div>
          {type === "course" && groups.length > 0 && (
            <div><label className={lbl}>Gruppo (opzionale)</label><select className={inp} value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Dalle</label><select className={inp} value={startMin} onChange={(e) => { const v = +e.target.value; setStartMin(v); if (endMin <= v) setEndMin(Math.min(DAY_END, v + 60)); }}>{TIME_OPTS.slice(0, -1).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</select></div>
            <div><label className={lbl}>Alle</label><select className={inp} value={endMin} onChange={(e) => setEndMin(+e.target.value)}>{TIME_OPTS.filter((m) => m > startMin).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</select></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            Ripeti ogni settimana
            {repeat && <>per <input type="number" min={2} max={52} value={weeks} onChange={(e) => setWeeks(Math.max(2, Math.min(52, +e.target.value || 2)))} className="w-16 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm" /> settimane</>}
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]">Annulla</button>
          <button disabled={pending} onClick={() => onSave({ startMin, endMin, type, title: title || undefined, groupId: groupId || undefined, repeatWeeks: repeat ? weeks : 1 })} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">{pending ? "Salvo…" : "Prenota"}</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ b, pending, onClose, onDelete, onDeleteSeries }: {
  b: CourtBookingView; pending: boolean; onClose: () => void; onDelete: () => void; onDeleteSeries: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card mt-24 w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{b.title || b.groupName || TYPES.find((t) => t.key === b.type)?.label}</h3>
          <button onClick={onClose} className="text-[var(--color-muted)]"><X className="h-4 w-4" /></button>
        </div>
        <div className="text-sm text-[var(--color-muted)]">{hhmm(b.startMin)}–{hhmm(b.endMin)} · {TYPES.find((t) => t.key === b.type)?.label}{b.seriesId ? " · serie settimanale ↻" : ""}</div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {b.seriesId && <button disabled={pending} onClick={onDeleteSeries} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:border-[#f87171] hover:text-[#f87171] disabled:opacity-50">Elimina serie</button>}
          <button disabled={pending} onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-lg bg-[#f87171] px-4 py-2 text-sm font-semibold text-[#0a0c10] disabled:opacity-50"><Trash2 className="h-4 w-4" />{pending ? "…" : "Elimina"}</button>
        </div>
      </div>
    </div>
  );
}

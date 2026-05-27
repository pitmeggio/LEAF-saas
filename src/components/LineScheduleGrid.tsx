"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLineBooking, deleteLineBooking, togglePayAndTrain } from "@/app/line-actions";

// Treningsskjema-style weekly grid.
//
// Rows: 7 days × N time-slots. Columns: every line, grouped by slope.
// Each cell renders either:
//   • empty (clickable → opens "create booking" mini-form)
//   • internal team booking (yellow chip, label = team code like "TRA")
//   • Pay-and-Train slot (green chip, with price + "OPEN" / customer name)
// The grid is a CSS grid with sticky-left day/slot column so wide academies
// (Trysil = 8 lines, future tennis clubs = 12+) stay scrollable horizontally.

type Slope = {
  id: string;
  name: string;
  lines: { id: string; label: string; position: number }[];
};

type Booking = {
  id: string;
  lineId: string;
  startAt: Date;
  endAt: Date;
  label: string | null;
  discipline: string | null;
  groupId: string | null;
  groupName: string | null;
  payAndTrainEnabled: boolean;
  customerName: string | null;
  customerEmail: string | null;
  bookerOrg: string | null;
  status: string;
  publicPrice: number | null;
  notes: string | null;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS: { key: string; label: string; sh: number; sm: number; eh: number; em: number }[] = [
  { key: "09-11", label: "09:00 – 11:00", sh: 9, sm: 0, eh: 11, em: 0 },
  { key: "11-13", label: "11:00 – 13:00", sh: 11, sm: 0, eh: 13, em: 0 },
  { key: "13-15", label: "13:00 – 15:00", sh: 13, sm: 0, eh: 15, em: 0 },
  { key: "15-16:30", label: "15:00 – 16:30", sh: 15, sm: 0, eh: 16, em: 30 },
  { key: "18-20", label: "18:00 – 20:00", sh: 18, sm: 0, eh: 20, em: 0 },
];

export function LineScheduleGrid({
  slopes,
  bookings,
  weekStart,
  isAdmin,
}: {
  slopes: Slope[];
  bookings: Booking[];
  weekStart: Date;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<{
    lineId: string;
    dayIndex: number;
    slotKey: string;
    booking?: Booking;
  } | null>(null);

  // Lookup map: lineId → dayIndex → slotKey → booking (first one that matches).
  // We compute the slotKey for a booking by checking which canonical SLOT
  // window its [startAt, endAt) fits inside (or overlaps with the start of).
  const cellMap = useMemo(() => {
    const m = new Map<string, Booking>();
    const wsTime = weekStart.getTime();
    for (const b of bookings) {
      const dayIndex = Math.floor((b.startAt.getTime() - wsTime) / (24 * 3600 * 1000));
      if (dayIndex < 0 || dayIndex > 6) continue;
      const startH = b.startAt.getUTCHours();
      const startM = b.startAt.getUTCMinutes();
      const slot = SLOTS.find(
        (s) =>
          (startH === s.sh && startM <= s.sm + 30) ||
          (startH > s.sh && startH < s.eh) ||
          (startH === s.sh && Math.abs(startM - s.sm) <= 30),
      );
      if (!slot) continue;
      m.set(`${b.lineId}|${dayIndex}|${slot.key}`, b);
    }
    return m;
  }, [bookings, weekStart]);

  const onCreate = (form: HTMLFormElement) => {
    if (!editing) return;
    const fd = new FormData(form);
    const slot = SLOTS.find((s) => s.key === editing.slotKey);
    if (!slot) return;
    const startAt = new Date(weekStart);
    startAt.setUTCDate(startAt.getUTCDate() + editing.dayIndex);
    startAt.setUTCHours(slot.sh, slot.sm, 0, 0);
    const endAt = new Date(weekStart);
    endAt.setUTCDate(endAt.getUTCDate() + editing.dayIndex);
    endAt.setUTCHours(slot.eh, slot.em, 0, 0);
    const payAndTrainEnabled = fd.get("payAndTrain") === "on";
    const publicPrice = fd.get("publicPrice") ? Number(fd.get("publicPrice")) : null;
    start(async () => {
      const r = await createLineBooking({
        lineId: editing.lineId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        label: (fd.get("label") as string) || null,
        discipline: (fd.get("discipline") as string) || null,
        notes: (fd.get("notes") as string) || null,
        payAndTrainEnabled,
        publicPrice,
      });
      if (r.ok) {
        setEditing(null);
        router.refresh();
      } else {
        alert(r.error);
      }
    });
  };

  const onDelete = (id: string) => {
    if (!confirm("Delete this booking?")) return;
    start(async () => {
      const r = await deleteLineBooking(id);
      if (r.ok) {
        setEditing(null);
        router.refresh();
      } else {
        alert(r.error);
      }
    });
  };

  const onToggleP2T = (b: Booking) => {
    start(async () => {
      const r = await togglePayAndTrain({
        bookingId: b.id,
        payAndTrainEnabled: !b.payAndTrainEnabled,
        publicPrice: b.publicPrice ?? 1500,
      });
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  };

  // Build the column layout: 2 sticky columns (day, slot) + 1 per line, grouped.
  const allLines = slopes.flatMap((s) => s.lines.map((l) => ({ ...l, slopeId: s.id, slopeName: s.name })));
  const colCount = 2 + allLines.length;

  return (
    <>
      <div className="card overflow-x-auto p-0">
        <div
          className="grid min-w-fit text-xs"
          style={{ gridTemplateColumns: `4.5rem 6.5rem repeat(${allLines.length}, minmax(7.5rem, 1fr))` }}
        >
          {/* Slope header row */}
          <div className="sticky left-0 z-10 col-span-2 border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            Week
          </div>
          {slopes.map((s) => (
            <div
              key={s.id}
              className="border-b border-l border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[11px] font-semibold"
              style={{ gridColumn: `span ${s.lines.length}` }}
            >
              {s.name}
              <span className="ml-1.5 text-[10px] font-normal text-[var(--color-muted)]">· {s.lines.length} lines</span>
            </div>
          ))}

          {/* Line label row */}
          <div className="sticky left-0 z-10 col-span-2 border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            Day · Slot
          </div>
          {allLines.map((l) => (
            <div
              key={l.id}
              className="border-b border-l border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-center text-[10px] font-medium text-[var(--color-muted)]"
            >
              L{l.label}
            </div>
          ))}

          {/* Day × slot rows */}
          {DAYS.map((day, dayIdx) =>
            SLOTS.map((slot, slotIdx) => {
              const dayDate = new Date(weekStart);
              dayDate.setUTCDate(dayDate.getUTCDate() + dayIdx);
              const isFirstSlotOfDay = slotIdx === 0;
              return (
                <DayRow
                  key={`${day}-${slot.key}`}
                  day={day}
                  date={dayDate}
                  slot={slot}
                  dayIdx={dayIdx}
                  isFirst={isFirstSlotOfDay}
                  lines={allLines}
                  cellMap={cellMap}
                  isAdmin={isAdmin}
                  onCellClick={(lineId, booking) => setEditing({ lineId, dayIndex: dayIdx, slotKey: slot.key, booking })}
                />
              );
            }),
          )}
        </div>
      </div>

      {/* Booking editor sheet — opens when admin clicks a cell */}
      {editing && (
        <BookingEditor
          editing={editing}
          slopes={slopes}
          pending={pending}
          onClose={() => setEditing(null)}
          onCreate={onCreate}
          onDelete={onDelete}
          onToggleP2T={onToggleP2T}
        />
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-[var(--color-muted)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#f59e0b]/70" /> Internal team</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[var(--color-accent)]/70" /> Pay-and-Train (open)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#38bdf8]/70" /> Pay-and-Train (sold)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#a78bfa]/70" /> External club</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-dashed border-[var(--color-border)]" /> Free</span>
      </div>
    </>
  );
}

function DayRow({
  day, date, slot, dayIdx, isFirst, lines, cellMap, isAdmin, onCellClick,
}: {
  day: string;
  date: Date;
  slot: { key: string; label: string };
  dayIdx: number;
  isFirst: boolean;
  lines: { id: string; label: string; slopeId: string }[];
  cellMap: Map<string, Booking>;
  isAdmin: boolean;
  onCellClick: (lineId: string, booking?: Booking) => void;
}) {
  return (
    <>
      {/* Day name (only rendered on first slot of the day) */}
      <div className="sticky left-0 z-10 flex items-center border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium">
        {isFirst && (
          <div>
            <div>{day}</div>
            <div className="text-[9px] font-normal text-[var(--color-muted)]">
              {date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            </div>
          </div>
        )}
      </div>
      {/* Slot label */}
      <div className="border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[10px] text-[var(--color-muted)]">
        {slot.label}
      </div>
      {/* One cell per line */}
      {lines.map((l) => {
        const key = `${l.id}|${dayIdx}|${slot.key}`;
        const b = cellMap.get(key);
        return (
          <div
            key={l.id}
            className="border-b border-l border-[var(--color-border)] p-1"
          >
            {b ? (
              <BookingChip booking={b} onClick={() => isAdmin && onCellClick(l.id, b)} />
            ) : isAdmin ? (
              <button
                type="button"
                onClick={() => onCellClick(l.id)}
                className="h-full min-h-[2.25rem] w-full rounded border border-dashed border-[var(--color-border)]/50 text-[10px] text-[var(--color-muted)]/40 transition-colors hover:border-[var(--color-accent)] hover:bg-[#7cff6b08] hover:text-[var(--color-accent)]"
                title="Click to book this slot"
              >
                +
              </button>
            ) : (
              <div className="h-full min-h-[2.25rem] rounded border border-dashed border-[var(--color-border)]/50" />
            )}
          </div>
        );
      })}
    </>
  );
}

function BookingChip({ booking, onClick }: { booking: Booking; onClick: () => void }) {
  const isInternal = !!booking.groupId;
  const isExternalClub = !isInternal && !booking.payAndTrainEnabled && booking.bookerOrg != null;
  const isPtSold = booking.payAndTrainEnabled && booking.customerEmail != null;
  // Yellow = internal team, blue = Pay-and-Train sold, purple = external
  // club self-booked, green = Pay-and-Train slot still open.
  const bg = isInternal
    ? "bg-[#f59e0b]/15 border-[#f59e0b]/40 text-[#f59e0b]"
    : isExternalClub
      ? "bg-[#a78bfa]/15 border-[#a78bfa]/40 text-[#a78bfa]"
      : isPtSold
        ? "bg-[#38bdf8]/15 border-[#38bdf8]/40 text-[#38bdf8]"
        : "bg-[#7cff6b]/15 border-[#7cff6b]/40 text-[var(--color-accent)]";
  const primary = isExternalClub
    ? booking.bookerOrg
    : booking.label || booking.groupName || (isPtSold ? booking.customerName : "OPEN");
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full min-h-[2.25rem] w-full flex-col items-start justify-center rounded border px-1.5 py-1 text-left text-[10px] font-medium ${bg}`}
      title={
        isExternalClub
          ? `${booking.bookerOrg} · ${booking.customerName ?? ""}`
          : (booking.notes ?? booking.label ?? "")
      }
    >
      <span className="truncate leading-tight">{primary}</span>
      {booking.discipline && <span className="text-[9px] opacity-80">{booking.discipline}</span>}
      {isPtSold && booking.publicPrice != null && booking.publicPrice > 0 && (
        <span className="text-[9px] opacity-80">€{booking.publicPrice}</span>
      )}
    </button>
  );
}

function BookingEditor({
  editing,
  slopes,
  pending,
  onClose,
  onCreate,
  onDelete,
  onToggleP2T,
}: {
  editing: { lineId: string; dayIndex: number; slotKey: string; booking?: Booking };
  slopes: Slope[];
  pending: boolean;
  onClose: () => void;
  onCreate: (form: HTMLFormElement) => void;
  onDelete: (id: string) => void;
  onToggleP2T: (b: Booking) => void;
}) {
  const line = slopes.flatMap((s) => s.lines.map((l) => ({ ...l, slopeName: s.name }))).find((l) => l.id === editing.lineId);
  const slot = SLOTS.find((s) => s.key === editing.slotKey);
  if (!line || !slot) return null;
  const existing = editing.booking;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center py-8">
        <div className="card w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{existing ? "Edit slot" : "New booking"}</h3>
              <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                {line.slopeName} · Line {line.label} · {DAYS[editing.dayIndex]} · {slot.label}
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">×</button>
          </div>

          {existing ? (
            <div className="space-y-3 text-sm">
              <dl className="space-y-1 text-xs">
                {existing.groupName && <Row label="Team" value={existing.groupName} />}
                {existing.label && <Row label="Label" value={existing.label} />}
                {existing.discipline && <Row label="Discipline" value={existing.discipline} />}
                {existing.customerName && <Row label="Customer" value={existing.customerName} />}
                {existing.publicPrice != null && existing.publicPrice > 0 && <Row label="Price" value={`€${existing.publicPrice}`} />}
                {existing.notes && <Row label="Notes" value={existing.notes} />}
              </dl>
              {!existing.groupId && !existing.customerEmail && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onToggleP2T(existing)}
                  className="w-full rounded-lg border border-[#7CFF6B40] bg-[#7cff6b12] px-3 py-2 text-xs font-medium text-[var(--color-accent)] disabled:opacity-50"
                >
                  {existing.payAndTrainEnabled ? "Disable Pay-and-Train" : "Enable Pay-and-Train · sell this slot publicly"}
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => onDelete(existing.id)}
                className="w-full rounded-lg border border-[#f8717140] bg-[#f8717108] px-3 py-2 text-xs font-medium text-[#f87171] disabled:opacity-50"
              >
                Delete slot
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); onCreate(e.currentTarget); }} className="space-y-3">
              <Field label="Label (team code, e.g. TRA, DEV)">
                <input name="label" className="inp" />
              </Field>
              <Field label="Discipline (SL / GS / SG / DH)">
                <input name="discipline" className="inp" placeholder="GS" />
              </Field>
              <Field label="Notes (optional)">
                <textarea name="notes" className="inp" rows={2} />
              </Field>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="payAndTrain" />
                  <span className="font-medium">Pay-and-Train</span>
                  <span className="text-[var(--color-muted)]">— sell this slot publicly</span>
                </label>
                <div className="mt-2">
                  <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Public price</label>
                  <input
                    name="publicPrice"
                    type="number"
                    min={0}
                    placeholder="1500"
                    className="inp mt-0.5"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg border border-[#7CFF6B40] bg-[#7cff6b12] px-3 py-2 text-sm font-medium text-[var(--color-accent)] disabled:opacity-50"
              >
                {pending ? "Saving…" : "Create booking"}
              </button>
              <style>{`.inp{width:100%;border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-surface-2);padding:0.4rem 0.6rem;font-size:0.8rem;outline:none}.inp:focus{border-color:var(--color-accent)}`}</style>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-0.5 block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="text-[var(--color-fg)]">{value}</dd>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookLineByExternalCoach } from "@/app/line-actions";

type Slope = { id: string; name: string; facility: string | null; active: boolean; lines: { id: string; label: string; position: number }[] };
type Booking = {
  lineId: string;
  startAt: string;
  endAt: string;
  kind: "internal" | "pt" | "external";
  bookerOrg: string | null;
  customerName: string | null;
};
type TimeSlot = { key: string; label: string; startHour: number; startMin: number; endHour: number; endMin: number };

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Public weekly grid the external coach interacts with. Rows = (day, slot),
// columns = (slope, line). Each cell shows the current booking (if any) or
// is clickable to launch the booking form for that line+time.
export function PublicLineGrid({
  slug,
  slopes,
  bookings,
  weekStart,
  slots,
  weekParam,
}: {
  slug: string;
  slopes: Slope[];
  bookings: Booking[];
  weekStart: string;
  slots: TimeSlot[];
  weekParam: string;
}) {
  const router = useRouter();
  const week = useMemo(() => new Date(weekStart), [weekStart]);
  const [open, setOpen] = useState<{ lineId: string; startAt: Date; endAt: Date; slopeName: string; lineLabel: string; dayLabel: string } | null>(null);

  // Index bookings by (lineId, dateKey, startMin) for O(1) cell lookup.
  const idx = useMemo(() => {
    const m = new Map<string, Booking>();
    for (const b of bookings) {
      const d = new Date(b.startAt);
      const key = `${b.lineId}|${d.toISOString().slice(0, 10)}|${d.getUTCHours() * 60 + d.getUTCMinutes()}`;
      m.set(key, b);
    }
    return m;
  }, [bookings]);

  // Also detect overlaps that don't share an exact start — if a booking
  // spans this cell's time window, treat the cell as taken.
  const overlapsCell = (lineId: string, date: Date, slot: TimeSlot): Booking | null => {
    const startMin = slot.startHour * 60 + slot.startMin;
    const endMin = slot.endHour * 60 + slot.endMin;
    const cellDayKey = date.toISOString().slice(0, 10);
    for (const b of bookings) {
      if (b.lineId !== lineId) continue;
      const bs = new Date(b.startAt);
      if (bs.toISOString().slice(0, 10) !== cellDayKey) continue;
      const bsMin = bs.getUTCHours() * 60 + bs.getUTCMinutes();
      const be = new Date(b.endAt);
      const beMin = be.getUTCHours() * 60 + be.getUTCMinutes();
      if (bsMin < endMin && beMin > startMin) return b;
    }
    return null;
  };

  if (slopes.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 p-12 text-center">
        <div className="text-2xl">🎿</div>
        <h2 className="text-base font-semibold">No slopes configured yet</h2>
        <p className="text-sm text-[var(--color-muted)]">The academy hasn&apos;t set up its line schedule.</p>
      </div>
    );
  }

  return (
    <>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--color-surface-2)] px-3 py-2 text-left font-medium text-[var(--color-muted)]">
                Day · Slot
              </th>
              {slopes.map((s) => (
                <th
                  key={s.id}
                  colSpan={s.lines.length}
                  className="border-l border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-left font-semibold"
                >
                  {s.name} <span className="ml-1 text-[10px] font-normal text-[var(--color-muted)]">· {s.lines.length} lines</span>
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-3 py-1.5 text-left font-medium text-[var(--color-muted)]">
                &nbsp;
              </th>
              {slopes.flatMap((s) =>
                s.lines.map((l, i) => (
                  <th
                    key={l.id}
                    className={`bg-[var(--color-surface)] px-1 py-1.5 text-center text-[10px] font-medium text-[var(--color-muted)] ${i === 0 ? "border-l border-[var(--color-border)]" : ""}`}
                  >
                    L{l.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {DAY_LABELS.flatMap((dayLabel, dayIdx) => {
              const date = new Date(week);
              date.setUTCDate(date.getUTCDate() + dayIdx);
              return slots.map((slot, slotIdx) => (
                <tr key={`${dayIdx}-${slot.key}`} className="border-t border-[var(--color-border)]">
                  <td className="sticky left-0 z-[5] whitespace-nowrap bg-[var(--color-bg)] px-3 py-1.5 text-[11px]">
                    {slotIdx === 0 && (
                      <span className="mr-2 font-semibold">
                        {dayLabel}{" "}
                        <span className="ml-0.5 text-[10px] text-[var(--color-muted)]">
                          {date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </span>
                      </span>
                    )}
                    <span className="text-[var(--color-muted)]">{slot.label}</span>
                  </td>
                  {slopes.flatMap((s) =>
                    s.lines.map((l, i) => {
                      const booking = overlapsCell(l.id, date, slot);
                      const startAt = new Date(date);
                      startAt.setUTCHours(slot.startHour, slot.startMin, 0, 0);
                      const endAt = new Date(date);
                      endAt.setUTCHours(slot.endHour, slot.endMin, 0, 0);
                      const cellBorder = i === 0 ? "border-l border-[var(--color-border)]" : "";
                      if (booking) {
                        const colorClass =
                          booking.kind === "internal"
                            ? "bg-[#facc15]/15 text-[#facc15]"
                            : booking.kind === "pt"
                              ? "bg-[#60a5fa]/15 text-[#60a5fa]"
                              : "bg-[#a78bfa]/15 text-[#a78bfa]";
                        const label =
                          booking.kind === "internal"
                            ? "TEAM"
                            : booking.kind === "pt"
                              ? "P&T"
                              : (booking.bookerOrg ?? "EXT").slice(0, 6).toUpperCase();
                        return (
                          <td key={l.id} className={`px-1 py-1 ${cellBorder}`}>
                            <div className={`rounded px-1.5 py-1 text-center text-[10px] font-medium ${colorClass}`}>
                              {label}
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={l.id} className={`px-1 py-1 ${cellBorder}`}>
                          <button
                            type="button"
                            onClick={() =>
                              setOpen({
                                lineId: l.id,
                                startAt,
                                endAt,
                                slopeName: s.name,
                                lineLabel: l.label,
                                dayLabel,
                              })
                            }
                            className="w-full rounded border border-dashed border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-1.5 py-1 text-center text-[10px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
                          >
                            +
                          </button>
                        </td>
                      );
                    }),
                  )}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <ExternalBookingModal
          slug={slug}
          weekParam={weekParam}
          target={open}
          onClose={() => setOpen(null)}
          onSuccess={() => {
            setOpen(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ExternalBookingModal({
  slug,
  weekParam,
  target,
  onClose,
  onSuccess,
}: {
  slug: string;
  weekParam: string;
  target: { lineId: string; startAt: Date; endAt: Date; slopeName: string; lineLabel: string; dayLabel: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [coachName, setCoachName] = useState("");
  const [coachEmail, setCoachEmail] = useState("");
  const [clubName, setClubName] = useState("");
  const [coachPhone, setCoachPhone] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await bookLineByExternalCoach({
        academySlug: slug,
        lineId: target.lineId,
        startAt: target.startAt.toISOString(),
        endAt: target.endAt.toISOString(),
        coachName,
        coachEmail,
        clubName,
        coachPhone: coachPhone || undefined,
        discipline: discipline || undefined,
      });
      if (r.ok) {
        const q = weekParam ? `w=${weekParam}&ok=1` : "ok=1";
        router.push(`/academy/${slug}/book/line?${q}`);
        onSuccess();
      } else {
        setErr(r.error);
      }
    });
  };

  const time = `${target.startAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} – ${target.endAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center py-8">
        <div className="card w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold">Book this line</h3>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            {target.dayLabel} {target.startAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })} ·
            {" "}{time} · {target.slopeName} · Line {target.lineLabel}
          </p>
          <form onSubmit={onSubmit} className="mt-4 space-y-3 text-sm">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Coach name *</label>
              <input
                className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Club / organization *</label>
              <input
                className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                required
                placeholder="e.g. Hafjell Race Team"
                minLength={2}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Email *</label>
              <input
                type="email"
                className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                value={coachEmail}
                onChange={(e) => setCoachEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Phone</label>
                <input
                  type="tel"
                  className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  value={coachPhone}
                  onChange={(e) => setCoachPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Discipline</label>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="">—</option>
                  <option value="SL">SL</option>
                  <option value="GS">GS</option>
                  <option value="SG">SG</option>
                  <option value="DH">DH</option>
                </select>
              </div>
            </div>
            {err && <p className="text-[11px] text-[#f87171]">{err}</p>}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg border border-[#7CFF6B40] bg-[#7cff6b12] px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] disabled:opacity-50"
              >
                {pending ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

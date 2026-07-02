"use client";

import { useState, useTransition } from "react";
import { setEventRsvp } from "@/app/board-actions";
import { RSVP_META, RSVP_ORDER, type RsvpStatus } from "@/lib/board/boardTypes";

// Compact three-way availability control shown under an upcoming event.
export function EventRsvp({ eventId, initial }: { eventId: string; initial: RsvpStatus | null }) {
  const [status, setStatus] = useState<RsvpStatus | null>(initial);
  const [pending, start] = useTransition();

  const choose = (s: RsvpStatus) => {
    if (pending) return;
    const prev = status;
    setStatus(s);
    start(async () => {
      const r = await setEventRsvp({ eventId, status: s });
      if (!r.ok) setStatus(prev); // revert on failure
    });
  };

  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5">
      {RSVP_ORDER.map((s) => {
        const meta = RSVP_META[s];
        const active = status === s;
        return (
          <button
            key={s}
            onClick={() => choose(s)}
            disabled={pending}
            className="rounded-xl border py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-60"
            style={active
              ? { background: meta.color, color: "#0a0c10", borderColor: meta.color }
              : { borderColor: "var(--color-border)", color: "var(--color-muted)" }}
          >
            {meta.icon} {meta.short}
          </button>
        );
      })}
    </div>
  );
}

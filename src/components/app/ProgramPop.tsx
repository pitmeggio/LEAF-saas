"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// The pop the athlete sees on the app home when the coach has just published a
// programme: "Il tuo allenatore ha pubblicato il programma…". Dismissible — we
// remember the seen programme id in localStorage so it doesn't nag every visit.
export function ProgramPop({ id, dateLabel, kindLabel, coachName }: { id: string; dateLabel: string; kindLabel: string; coachName: string | null }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(`leaf-prog-seen-${id}`) !== "1") setShow(true);
    } catch {
      setShow(true);
    }
  }, [id]);

  if (!show) return null;
  const dismiss = () => {
    try { localStorage.setItem(`leaf-prog-seen-${id}`, "1"); } catch { /* no-op */ }
    setShow(false);
  };

  return (
    <div className="mb-4 rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--color-accent) 45%, var(--color-border))", background: "color-mix(in srgb, var(--color-accent) 10%, transparent)" }}>
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden>📣</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{coachName ? `${coachName} ha pubblicato il programma` : "Nuovo programma pubblicato"}</div>
          <div className="mt-0.5 text-xs text-[var(--color-muted)]">{kindLabel} · {dateLabel}</div>
          <div className="mt-2.5 flex items-center gap-2">
            <Link href={`/app/programs/${id}`} onClick={dismiss} className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[#0a0c10]">
              Apri il programma →
            </Link>
            <button type="button" onClick={dismiss} className="px-2 py-1.5 text-xs text-[var(--color-muted)]">Più tardi</button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSession, saveAttendance, deleteSession } from "@/app/attendance-actions";

type Status = "present" | "late" | "absent" | "excused" | "injured";
const STATUSES: { key: Status; label: string; color: string }[] = [
  { key: "present", label: "Present", color: "var(--color-accent)" },
  { key: "late", label: "Late", color: "#f59e0b" },
  { key: "absent", label: "Absent", color: "#f87171" },
  { key: "excused", label: "Excused", color: "#9aa4b6" },
  { key: "injured", label: "Injured", color: "#a78bfa" },
];

type RosterRow = { enrollmentId: string; name: string; ratePct: number | null; sessionsTracked: number };
type Session = { id: string; date: string; title: string | null; records: Record<string, string> };

export function AttendanceBoard({ groupId, roster, sessions }: { groupId: string; roster: RosterRow[]; sessions: Session[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(sessions[0]?.id ?? null);
  const active = sessions.find((s) => s.id === activeId) ?? null;

  // Local marks for the active session (seeded from saved records).
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const seeded = active ? { ...Object.fromEntries(Object.entries(active.records)) as Record<string, Status>, ...marks } : marks;

  const newSession = () => {
    const date = new Date().toISOString().slice(0, 10);
    start(async () => {
      const r = await createSession({ groupId, date, title: "" });
      if (r.ok) { setMarks({}); router.refresh(); if (r.id) setActiveId(r.id); }
      else alert(r.error);
    });
  };

  const setMark = (enrollmentId: string, status: Status) => setMarks((m) => ({ ...m, [enrollmentId]: status }));
  const setAll = (status: Status) => setMarks(Object.fromEntries(roster.map((r) => [r.enrollmentId, status])));

  const save = () => {
    if (!active) return;
    const entries = roster.map((r) => ({ enrollmentId: r.enrollmentId, status: (seeded[r.enrollmentId] ?? "present") as Status }));
    start(async () => {
      const r = await saveAttendance({ sessionId: active.id, entries });
      if (r.ok) { setMarks({}); router.refresh(); } else alert(r.error);
    });
  };

  const removeSession = (id: string) => {
    if (!confirm("Delete this session and its attendance?")) return;
    start(async () => { await deleteSession(id); setActiveId(null); router.refresh(); });
  };

  return (
    <div className="space-y-5">
      {/* Sessions row */}
      <div className="flex flex-wrap items-center gap-2">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => { setActiveId(s.id); setMarks({}); }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${activeId === s.id ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-fg)]" : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}
          >
            {new Date(s.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
          </button>
        ))}
        <button onClick={newSession} disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          + New session (today)
        </button>
      </div>

      {!active ? (
        <div className="card p-8 text-center text-sm text-[var(--color-muted)]">Create a session to take attendance.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
            <div className="text-sm font-semibold">{new Date(active.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "long" })}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setAll("present")} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]">Mark all present</button>
              <button onClick={() => removeSession(active.id)} className="text-xs text-[#f87171] hover:underline">Delete</button>
            </div>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {roster.length === 0 && <div className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">No active athletes in this group.</div>}
            {roster.map((r) => {
              const cur = (seeded[r.enrollmentId] ?? "present") as Status;
              return (
                <div key={r.enrollmentId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    {r.ratePct != null && <div className="text-[11px] text-[var(--color-muted)]">{r.ratePct}% attendance · {r.sessionsTracked} sessions</div>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {STATUSES.map((st) => (
                      <button
                        key={st.key}
                        onClick={() => setMark(r.enrollmentId, st.key)}
                        className="rounded-md px-2 py-1 text-[11px] font-medium"
                        style={cur === st.key ? { background: st.color, color: "#0a0c10" } : { background: "var(--color-surface-2)", color: "var(--color-muted)" }}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {roster.length > 0 && (
            <div className="flex justify-end border-t border-[var(--color-border)] px-4 py-3">
              <button onClick={save} disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
                {pending ? "Saving…" : "Save attendance"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

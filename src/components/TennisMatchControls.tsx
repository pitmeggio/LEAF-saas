"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTennisMatch, deleteTennisMatch } from "@/app/tennis-match-actions";

// Compact one-line form for logging a new tennis match. Stays collapsed
// behind a "+ Log match" button so the panel reads as a clean list.
export function TennisMatchForm({ athleteId }: { athleteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [opponent, setOpponent] = useState("");
  const [result, setResult] = useState<"won" | "lost">("won");
  const [score, setScore] = useState("");
  const [surface, setSurface] = useState<"" | "hard" | "clay" | "grass" | "indoor">("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]"
      >
        + Log match
      </button>
    );
  }

  function submit() {
    setErr(null);
    start(async () => {
      const res = await createTennisMatch({
        athleteId,
        date,
        opponent,
        result,
        // Schema's optText/optional transforms accept undefined; pass strings or omit.
        ...(score ? { score } : {}),
        ...(surface ? { surface } : {}),
        ...(notes ? { notes } : {}),
      } as Parameters<typeof createTennisMatch>[0]);
      if (!res.ok) { setErr(res.error); return; }
      setOpponent(""); setScore(""); setNotes(""); setSurface(""); setResult("won");
      setOpen(false);
      router.refresh();
    });
  }

  const inp = "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs focus:border-[var(--color-accent)] focus:outline-none";

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">New match</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="text" placeholder="Opponent *" className={inp} value={opponent} onChange={(e) => setOpponent(e.target.value)} />
        <select className={inp} value={result} onChange={(e) => setResult(e.target.value as "won" | "lost")}>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <select className={inp} value={surface} onChange={(e) => setSurface(e.target.value as typeof surface)}>
          <option value="">Surface…</option>
          <option value="hard">Hard</option>
          <option value="clay">Clay</option>
          <option value="grass">Grass</option>
          <option value="indoor">Indoor</option>
        </select>
        <input type="text" placeholder="Score (e.g. 6-3 4-6 7-5)" className={`${inp} sm:col-span-2`} value={score} onChange={(e) => setScore(e.target.value)} />
        <input type="text" placeholder="Notes (optional)" className={`${inp} sm:col-span-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        {err && <span className="text-xs text-[#f87171]">{err}</span>}
        <button type="button" onClick={() => { setOpen(false); setErr(null); }} className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)]">Cancel</button>
        <button
          type="button"
          disabled={pending || !opponent.trim()}
          onClick={submit}
          className="rounded-md bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save match"}
        </button>
      </div>
    </div>
  );
}

export function DeleteMatchButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title="Delete match"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this match?")) return;
        start(async () => {
          const res = await deleteTennisMatch({ id });
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
      className="text-[10px] text-[var(--color-muted)] hover:text-[#f87171] disabled:opacity-50"
    >
      ✕
    </button>
  );
}

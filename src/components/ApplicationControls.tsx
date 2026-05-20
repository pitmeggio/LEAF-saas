"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STATUSES, STATUS_LABEL, STATUS_COLOR, type Status } from "@/lib/domain";
import { moveApplication, addNote } from "@/app/actions";

export function StatusSelector({ applicationId, current }: { applicationId: string; current: Status }) {
  const [status, setStatus] = useState(current);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function change(to: Status) {
    if (to === status) return;
    setStatus(to);
    startTransition(async () => {
      await moveApplication(applicationId, to);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((s) => {
        const active = s === status;
        const c = STATUS_COLOR[s];
        return (
          <button
            key={s}
            onClick={() => change(s)}
            disabled={isPending}
            className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
            style={
              active
                ? { background: c, color: "#0a0c10" }
                : { background: "var(--color-surface-2)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }
            }
          >
            {STATUS_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

export function AddNoteForm({ applicationId }: { applicationId: string }) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!body.trim()) return;
    const text = body;
    setBody("");
    startTransition(async () => {
      await addNote(applicationId, text);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note about this candidate…"
        rows={3}
        className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={isPending || !body.trim()}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-40"
        >
          {isPending ? "Saving…" : "Add note"}
        </button>
      </div>
    </div>
  );
}

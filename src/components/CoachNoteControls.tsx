"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCoachNote } from "@/app/coach-notes-actions";

// Tiny client wrapper around the deleteCoachNote action. Lives apart from the
// note panel so the panel stays a pure server component.
export function DeleteCoachNoteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title="Delete note"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this coach note? The aggregate AI profile will not be recomputed.")) return;
        start(async () => {
          const res = await deleteCoachNote({ id });
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
      className="text-[var(--color-muted)] hover:text-[#f87171] disabled:opacity-50"
    >
      ✕
    </button>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishProgram, unpublishProgram, deleteProgram } from "@/app/program-actions";

const btn = "rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50";

export function ProgramActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { const r = await fn(); if (!r.ok && r.error) alert(r.error); router.refresh(); });

  return (
    <div className="flex items-center gap-1.5">
      {status === "published" ? (
        <button disabled={pending} className={btn} onClick={() => run(() => unpublishProgram(id))}>Ritira</button>
      ) : (
        <button disabled={pending} onClick={() => run(() => publishProgram(id))}
          className="rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          Pubblica
        </button>
      )}
      <button disabled={pending} className={btn} onClick={() => { if (confirm("Eliminare il programma?")) run(() => deleteProgram(id)); }}>Elimina</button>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTimingBatch } from "@/app/timing-actions";

export function TimingBatchDelete({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Elimina sessione importata"
      onClick={() => {
        if (!confirm("Eliminare questa sessione importata?")) return;
        start(async () => { await deleteTimingBatch(batchId); router.refresh(); });
      }}
      className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[#f87171] disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );
}

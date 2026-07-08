"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTrip } from "@/app/trip-actions";

export function DeleteTripButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button disabled={pending} onClick={() => start(async () => { const r = await deleteTrip(id); if (r.ok) router.push("/dashboard/trips"); })} className="rounded-md bg-[#ef5f6b] px-3 py-1.5 text-xs font-semibold text-white">Elimina trasferta</button>
        <button onClick={() => setConfirming(false)} className="text-xs text-[var(--color-muted)]">Annulla</button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[#ef5f6b]"><Trash2 className="h-3.5 w-3.5" />Elimina</button>
  );
}

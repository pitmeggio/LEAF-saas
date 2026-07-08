"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plane, Plus } from "lucide-react";
import { createTrip } from "@/app/trip-actions";

// Create a trasferta. On success routes straight into the trip so staff can
// add participants + expenses immediately.
export function TripCreateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", location: "", zone: "", startDate: "", endDate: "", notes: "" });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = () =>
    start(async () => {
      setErr(null);
      const r = await createTrip(f);
      if (r.ok && r.data) { setOpen(false); router.push(`/dashboard/trips/${r.data.id}`); }
      else if (!r.ok) setErr(r.error);
    });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
        <Plus className="h-4 w-4" /> Nuova trasferta
      </button>
    );
  }

  const field = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
  const lbl = "text-[10px] uppercase tracking-wider text-[var(--color-muted)]";

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2"><Plane className="h-4 w-4 text-[var(--color-accent)]" /><h2 className="text-sm font-semibold">Nuova trasferta</h2></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className={lbl}>Nome</span><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="es. Kufstein" className={field} /></label>
        <label className="flex flex-col gap-1"><span className={lbl}>Località (facolt.)</span><input value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="es. Kufstein (AT)" className={field} /></label>
        <label className="flex flex-col gap-1"><span className={lbl}>Dal</span><input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={field} /></label>
        <label className="flex flex-col gap-1"><span className={lbl}>Al (facolt.)</span><input type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} className={field} /></label>
        <label className="flex flex-col gap-1"><span className={lbl}>Zona (facolt.)</span><input value={f.zone} onChange={(e) => set("zone", e.target.value)} placeholder="es. Estero, Veneto" className={field} /></label>
        <label className="flex flex-col gap-1"><span className={lbl}>Note (facolt.)</span><input value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="es. torneo ITF U16" className={field} /></label>
      </div>
      {err && <p className="mt-2 text-xs text-[#f87171]">{err}</p>}
      <div className="mt-4 flex items-center gap-2">
        <button disabled={pending || !f.name || !f.startDate} onClick={submit} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">{pending ? "Creo…" : "Crea trasferta"}</button>
        <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]">Annulla</button>
      </div>
    </div>
  );
}

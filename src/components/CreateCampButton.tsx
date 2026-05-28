"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createCamp } from "@/app/court-actions";

export function CreateCampButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    ageMin: "8",
    ageMax: "14",
    level: "intermedio",
    capacity: "20",
    price: "250",
    description: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await createCamp({
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        ageMin: form.ageMin || undefined,
        ageMax: form.ageMax || undefined,
        level: form.level || undefined,
        capacity: form.capacity,
        price: form.price,
        description: form.description || undefined,
      });
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else setErr(r.error);
    });
  };

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const trigger = (
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-[#a78bfa]/40 bg-[#a78bfa]/15 px-3 py-1.5 text-sm font-medium text-[#a78bfa] hover:bg-[#a78bfa]/25">
      + Apri camp
    </button>
  );

  if (!open) return trigger;

  const overlay = (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="flex min-h-full items-center justify-center py-8">
        <div className="card w-full max-w-lg p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold">Apri un camp</h3>
          <form onSubmit={onSubmit} className="mt-4 space-y-3 text-sm">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Nome camp *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Summer Camp Settimana 1" className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Inizio *</label>
                <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} required className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Fine *</label>
                <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} required className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Età min</label>
                <input type="number" min={3} max={80} value={form.ageMin} onChange={(e) => set("ageMin", e.target.value)} className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Età max</label>
                <input type="number" min={3} max={80} value={form.ageMax} onChange={(e) => set("ageMax", e.target.value)} className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Livello</label>
                <select value={form.level} onChange={(e) => set("level", e.target.value)} className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]">
                  <option value="principiante">Principiante</option>
                  <option value="intermedio">Intermedio</option>
                  <option value="agonista">Agonista</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Capacità *</label>
                <input type="number" min={1} max={200} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} required className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Prezzo *</label>
                <input type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} required className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Descrizione</label>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Tecnica + match play, due sessioni al giorno + analisi video." className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]" />
            </div>
            {err && <p className="text-[11px] text-[#f87171]">{err}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]">Annulla</button>
              <button type="submit" disabled={pending} className="rounded-lg border border-[#a78bfa]/40 bg-[#a78bfa]/15 px-3 py-1.5 text-sm font-medium text-[#a78bfa] disabled:opacity-50">{pending ? "Salvo…" : "Crea camp"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      {mounted && createPortal(overlay, document.body)}
    </>
  );
}

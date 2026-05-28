"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createFacility } from "@/app/court-actions";

export function CreateFacilityButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [courtCount, setCourtCount] = useState(4);
  const [surface, setSurface] = useState("clay");
  const [indoor, setIndoor] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await createFacility({ name, address: address || undefined, courtCount, surface, indoor });
      if (r.ok) {
        setOpen(false);
        setName(""); setAddress(""); setCourtCount(4); setSurface("clay"); setIndoor(false);
        router.refresh();
      } else setErr(r.error);
    });
  };

  const trigger = (
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface-2)]">
      + Aggiungi sede
    </button>
  );

  if (!open) return trigger;

  const overlay = (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="flex min-h-full items-center justify-center py-8">
        <div className="card w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold">Aggiungi sede</h3>
          <form onSubmit={onSubmit} className="mt-4 space-y-3 text-sm">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Nome sede *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Sede Centrale Padova" className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Indirizzo</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Via Roma 1, Padova" className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Numero campi *</label>
                <input type="number" min={1} max={50} value={courtCount} onChange={(e) => setCourtCount(Number(e.target.value) || 1)} required className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Superficie</label>
                <select value={surface} onChange={(e) => setSurface(e.target.value)} className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]">
                  <option value="clay">Terra rossa</option>
                  <option value="hard">Cemento</option>
                  <option value="grass">Erba</option>
                  <option value="carpet">Sintetico</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Indoor</label>
                <select value={String(indoor)} onChange={(e) => setIndoor(e.target.value === "true")} className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]">
                  <option value="false">Outdoor</option>
                  <option value="true">Indoor</option>
                </select>
              </div>
            </div>
            {err && <p className="text-[11px] text-[#f87171]">{err}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]">Annulla</button>
              <button type="submit" disabled={pending} className="rounded-lg border border-[#a78bfa]/40 bg-[#a78bfa]/15 px-3 py-1.5 text-sm font-medium text-[#a78bfa] disabled:opacity-50">{pending ? "Salvo…" : "Crea sede"}</button>
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

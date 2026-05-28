"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createSlope } from "@/app/line-actions";

// Inline modal to add a new slope (e.g. "Slope 63") + the number of lines
// on it. Auto-creates Line 1..N rows underneath so the grid is usable
// the moment the slope is saved.
export function CreateSlopeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [facility, setFacility] = useState("");
  const [lineCount, setLineCount] = useState(5);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await createSlope({ name, facility: facility || undefined, lineCount });
      if (r.ok) {
        setOpen(false);
        setName("");
        setFacility("");
        setLineCount(5);
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface-2)]"
    >
      + Add slope
    </button>
  );

  if (!open) return trigger;

  const overlay = (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="flex min-h-full items-center justify-center py-8">
        <div className="card w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-3 text-sm font-semibold">Add slope</h3>
          <form onSubmit={onSubmit} className="space-y-3 text-sm">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Slope name *</label>
              <input
                className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Slope 63"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Facility</label>
              <input
                className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                placeholder="Trysil Race Center Høgegga"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">How many lines?</label>
              <input
                type="number"
                min={1}
                max={20}
                className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                value={lineCount}
                onChange={(e) => setLineCount(Number(e.target.value) || 1)}
                required
              />
              <p className="mt-1 text-[10px] text-[var(--color-muted)]">LEAF auto-creates Line 1 to Line {lineCount}. You can rename them later.</p>
            </div>
            {err && <p className="text-[11px] text-[#f87171]">{err}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]">Cancel</button>
              <button type="submit" disabled={pending} className="rounded-lg border border-[#7CFF6B40] bg-[#7cff6b12] px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] disabled:opacity-50">
                {pending ? "Saving…" : "Create slope"}
              </button>
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

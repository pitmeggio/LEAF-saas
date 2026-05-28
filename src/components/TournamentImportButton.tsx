"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { importTournamentCalendar } from "@/app/tournament-actions";

// Excel import for the tennis tournament catalogue (Max's CALENDARI TORNEI
// format). Drag-and-drop or pick file, choose year, fire. Result modal
// shows catalogue / plans / entries counts + missing athletes warning.
//
// Uses createPortal to escape PageHeader's backdrop-blur containing block
// (same pattern as CalendarImportButton / LineImportButton).
export function TournamentImportButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [year, setYear] = useState(new Date().getFullYear());
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    catalogue: number;
    plans: number;
    entries: number;
    athletesMissing: string[];
    warnings: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const close = () => {
    setOpen(false);
    setErr(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const f = fileRef.current?.files?.[0];
    if (!f) { setErr("Seleziona un file."); return; }
    const fd = new FormData();
    fd.append("file", f);
    fd.append("year", String(year));
    start(async () => {
      const r = await importTournamentCalendar(fd);
      if (r.ok) {
        setResult(r.data!);
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  };

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="rounded-lg border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-3 py-1.5 text-sm font-medium text-[#a78bfa] hover:bg-[#a78bfa]/20"
    >
      📂 Importa CALENDARI TORNEI
    </button>
  );

  if (!open) return trigger;

  const overlay = (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <div className="flex min-h-full items-center justify-center py-8">
        <div className="card w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {!result ? (
            <>
              <h3 className="text-sm font-semibold">Importa calendario tornei</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                File Excel formato Max — un foglio per atleta, 12 mesi × settimane. LEAF estrae il catalogo tornei + popola i piani stagionali.
              </p>
              <form onSubmit={onSubmit} className="mt-4 space-y-3 text-sm">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">File Excel *</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    required
                    className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-[#a78bfa]/15 file:px-2 file:py-1 file:text-xs file:font-medium file:text-[#a78bfa]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Anno *</label>
                  <input
                    type="number"
                    min={2020}
                    max={2099}
                    required
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
                    className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[#a78bfa]"
                  />
                  <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                    Il foglio non ha l'anno — i tornei vengono ancorati a questa stagione.
                  </p>
                </div>
                {err && <p className="text-[11px] text-[#f87171]">{err}</p>}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={close} className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]">
                    Annulla
                  </button>
                  <button type="submit" disabled={pending} className="rounded-lg border border-[#a78bfa]/40 bg-[#a78bfa]/15 px-3 py-1.5 text-sm font-medium text-[#a78bfa] disabled:opacity-50">
                    {pending ? "Importing…" : "Importa"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-[#a78bfa]/40 bg-[#a78bfa]/10 p-3">
                <div className="text-sm font-semibold text-[#a78bfa]">Import completato</div>
                <ul className="mt-2 space-y-0.5 text-xs text-[var(--color-fg)]/85">
                  <li>· {result.catalogue} tornei nel catalogo</li>
                  <li>· {result.plans} piani atleta creati</li>
                  <li>· {result.entries} entries pianificate</li>
                </ul>
              </div>
              {result.athletesMissing.length > 0 && (
                <div className="mt-3 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-3 text-xs">
                  <div className="font-semibold text-[#f59e0b]">Atleti non trovati</div>
                  <p className="mt-1 text-[var(--color-muted)]">
                    Crea questi atleti prima di re-importare per non perderne i piani:
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-[var(--color-fg)]/80">
                    {result.athletesMissing.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                </div>
              )}
              {result.warnings.length > 0 && (
                <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3 text-[11px] text-[var(--color-muted)]">
                  {result.warnings.slice(0, 5).join(" · ")}
                </div>
              )}
              <div className="mt-4 flex items-center justify-end">
                <button type="button" onClick={close} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface-2)]">
                  Done
                </button>
              </div>
            </>
          )}
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

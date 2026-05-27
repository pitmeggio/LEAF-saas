"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importTreningsskjema } from "@/app/line-actions";

// Excel import for the line schedule (Trysil's Treningsskjema layout). The
// parser is in src/lib/treningsskjemaParser.ts — this UI just collects the
// file + year (the sheet doesn't carry one) and shows the result summary.
export function LineImportButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [year, setYear] = useState(new Date().getFullYear());
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    weekNumber: number | null;
    warnings: string[];
    slopesCreated: number;
    linesCreated: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setErr(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErr("Pick a Treningsskjema.xlsx file first.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("year", String(year));
    fd.append("fileName", file.name);
    start(async () => {
      const r = await importTreningsskjema(fd);
      if (r.ok) {
        setResult(r.data!);
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface-2)]"
        title="Drop your Treningsskjema.xlsx and LEAF places every cell on the grid"
      >
        📂 Import Excel
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div className="flex min-h-full items-center justify-center py-8">
        <div className="card w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-1 text-sm font-semibold">Import Treningsskjema</h3>
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            Drop the weekly Excel — LEAF places every cell on the grid and auto-creates new slopes / lines if needed.
          </p>

          {!result ? (
            <form onSubmit={onSubmit} className="space-y-3 text-sm">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Excel file *</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  required
                  className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-accent)]/15 file:px-2 file:py-1 file:text-xs file:font-medium file:text-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Year *</label>
                <input
                  type="number"
                  min={2020}
                  max={2099}
                  required
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
                  className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                />
                <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                  Treningsskjema cells store day + month only — pick the year these dates belong to.
                </p>
              </div>
              {err && <p className="text-[11px] text-[#f87171]">{err}</p>}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={close} className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg border border-[#7CFF6B40] bg-[#7cff6b12] px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] disabled:opacity-50"
                >
                  {pending ? "Importing…" : "Import schedule"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-3">
                <div className="text-sm font-semibold text-[var(--color-accent)]">
                  {result.weekNumber ? `Week ${result.weekNumber} imported` : "Import done"}
                </div>
                <ul className="mt-2 space-y-0.5 text-xs text-[var(--color-fg)]/85">
                  <li>· {result.created} bookings created</li>
                  {result.skipped > 0 && <li>· {result.skipped} already on grid (skipped)</li>}
                  {result.slopesCreated > 0 && <li>· {result.slopesCreated} new slopes auto-created</li>}
                  {result.linesCreated > 0 && <li>· {result.linesCreated} new lines auto-created</li>}
                </ul>
              </div>
              {result.warnings.length > 0 && (
                <div className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-3">
                  <div className="text-xs font-semibold text-[#f59e0b]">Warnings</div>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-[var(--color-fg)]/80">
                    {result.warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>· {w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]"
                >
                  Import another
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface-2)]"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

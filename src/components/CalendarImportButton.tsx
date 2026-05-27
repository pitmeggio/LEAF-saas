"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importCalendarFromFile, type ImportResult } from "@/app/calendar-actions";

// File-drop / file-picker import flow on the Calendar page. Coach uploads
// the season-plan spreadsheet they already keep in Excel; LEAF parses the
// rows and writes CalendarEvent records to their group. Marius (admin)
// sees the events instantly because they live on the same table — no
// extra "publish" step.

type Group = { id: string; name: string };

export function CalendarImportButton({
  groups,
  isAdmin,
}: {
  groups: Group[];
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? "");
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    setResult(null);
    const fd = new FormData();
    fd.append("file", f);
    if (groupId) fd.append("groupId", groupId);
    start(async () => {
      const r = await importCalendarFromFile(fd);
      setResult(r);
      if (r.ok) {
        router.refresh();
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[#7CFF6B40] bg-[#7cff6b12] px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[#7cff6b20]"
      >
        📂 Import from Excel
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div
        className="card w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Import calendar from Excel / CSV</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Drop the file you already keep. Headers can be in English or Italian.
            </p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">×</button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Group picker — admin can target any group, coach can only
              target one of their own (server enforces; this just picks
              which one when they have more than one). */}
          {(groups.length > 1 || isAdmin) && (
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                Import events into
              </label>
              <select
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                {isAdmin && <option value="">Academy-wide (visible to all teams)</option>}
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
              File
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              required
              className="block w-full text-xs file:mr-3 file:rounded-md file:border file:border-[var(--color-border)] file:bg-[var(--color-surface-2)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--color-fg)] hover:file:bg-[var(--color-surface)]"
            />
          </div>

          {/* Expected columns hint — set once-trained users at ease. */}
          <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-[11px]">
            <summary className="cursor-pointer text-[var(--color-muted)]">Expected columns (any of these work)</summary>
            <div className="mt-2 space-y-1 text-[var(--color-muted)]">
              <p>One row per event. Header row at the top of the sheet.</p>
              <ul className="list-disc pl-4">
                <li><span className="font-medium text-[var(--color-fg)]">Start / Data inizio</span> — required (e.g. 04/12/2026 or 2026-12-04)</li>
                <li><span className="font-medium text-[var(--color-fg)]">End / Data fine</span> — optional, for multi-day events</li>
                <li><span className="font-medium text-[var(--color-fg)]">Type / Tipo</span> — camp · race · training · travel · meeting · off</li>
                <li><span className="font-medium text-[var(--color-fg)]">Location / Luogo</span> — Saas-Fee, Hemsedal, …</li>
                <li><span className="font-medium text-[var(--color-fg)]">Notes / Note</span> — free text</li>
              </ul>
              <p className="pt-1">Unknown types fall back to &quot;other&quot;; bad rows are skipped with a warning, never silently dropped.</p>
            </div>
          </details>

          {result && (
            <div className={`rounded-lg border p-3 text-xs ${result.ok ? "border-[#7CFF6B40] bg-[#7cff6b10] text-[var(--color-accent)]" : "border-[#f8717140] bg-[#f8717110] text-[#f87171]"}`}>
              {result.ok ? (
                <>
                  <div className="font-medium">✓ Imported {result.created} event{result.created === 1 ? "" : "s"} from &quot;{result.sheetName}&quot;.</div>
                  {result.skipped > 0 && (
                    <div className="mt-1 text-[var(--color-muted)]">{result.skipped} row{result.skipped === 1 ? "" : "s"} skipped (see warnings).</div>
                  )}
                  {result.warnings.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-[10px] text-[var(--color-muted)]">
                      {result.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                      {result.warnings.length > 5 && <li>+{result.warnings.length - 5} more</li>}
                    </ul>
                  )}
                </>
              ) : (
                <div>{result.error}</div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg border border-[#7CFF6B40] bg-[#7cff6b12] px-4 py-2 text-sm font-medium text-[var(--color-accent)] disabled:opacity-50"
            >
              {pending ? "Importing…" : "Import"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

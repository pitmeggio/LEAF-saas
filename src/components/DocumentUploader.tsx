"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type Athlete = { enrollmentId: string; label: string };
type DocType = { value: string; label: string };

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// "App Documents" — real in-app upload (PDF / Word / Excel). Posts multipart to
// /api/documents/upload, which stores the bytes in Postgres and flips the
// document's status to "uploaded". Replaces the old "coming soon" placeholder.
export function DocumentUploader({ athletes, docTypes }: { athletes: Athlete[]; docTypes: DocType[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [enrollmentId, setEnrollmentId] = useState("");
  const [type, setType] = useState(docTypes[0]?.value ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => setMounted(true), []);

  const reset = () => {
    setEnrollmentId("");
    setType(docTypes[0]?.value ?? "");
    setFile(null);
    setErr(null);
    if (fileInput.current) fileInput.current.value = "";
  };
  const close = () => { setOpen(false); reset(); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!enrollmentId) return setErr("Pick an athlete first.");
    if (!file) return setErr("Choose a PDF, Word or Excel file.");
    const fd = new FormData();
    fd.set("enrollmentId", enrollmentId);
    fd.set("type", type);
    fd.set("file", file);
    start(async () => {
      try {
        const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
        const json = await res.json().catch(() => ({ ok: false }));
        if (res.ok && json.ok) {
          close();
          router.refresh();
        } else {
          setErr(json.error ?? "Upload failed.");
        }
      } catch {
        setErr("Upload failed — check your connection and try again.");
      }
    });
  };

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]"
    >
      + Upload file
    </button>
  );

  if (!open) return trigger;

  const overlay = (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <div className="flex min-h-full items-center justify-center py-8">
        <div className="card w-full max-w-lg p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold">Upload document</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            PDF, Word or Excel · max 10&nbsp;MB. The file is stored in LEAF and the document is marked <span className="font-medium">uploaded</span>.
          </p>
          <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Athlete *</label>
              <select
                required
                value={enrollmentId}
                onChange={(e) => setEnrollmentId(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">— pick an athlete —</option>
                {athletes.map((a) => (
                  <option key={a.enrollmentId} value={a.enrollmentId}>{a.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Document type *</label>
              <select
                required
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              >
                {docTypes.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">File *</label>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs outline-none file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#0a0c10] focus:border-[var(--color-accent)]"
              />
              {file && <p className="mt-1 text-[11px] text-[var(--color-muted)]">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
            </div>
            {err && <p className="text-[11px] text-[#f87171]">{err}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={close} className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]">Cancel</button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
              >
                {pending ? "Uploading…" : "Upload"}
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

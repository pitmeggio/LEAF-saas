"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Upload, Check, Trash2, FileSpreadsheet, Euro } from "lucide-react";
import { approveTimesheet, markTimesheetPaid, unmarkTimesheetPaid, deleteTimesheet } from "@/app/timesheet-actions";
import { TS_STATUS_META, periodLabel, computeAmount, type TimesheetView, type TimesheetStatus } from "@/lib/timesheets/timesheetTypes";

function money(v: number | null, currency: string): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

// Foglio ore & Stipendi. Coaches submit hours (+ optional Excel); admin/office
// approve → mark paid. `canSubmit` shows the submit form, `canManage` the
// approve/pay controls. One component drives both the coach and staff pages.
export function TimesheetManager({ rows, currency, canSubmit, canManage }: {
  rows: TimesheetView[]; currency: string; canSubmit: boolean; canManage: boolean;
}) {
  const router = useRouter();
  return (
    <div className="space-y-6">
      {canSubmit && <SubmitForm currency={currency} onDone={() => router.refresh()} />}
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-[var(--color-muted)]">Nessun foglio ore ancora.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => <Row key={t.id} t={t} currency={currency} canManage={canManage} />)}
        </div>
      )}
    </div>
  );
}

function SubmitForm({ currency, onDone }: { currency: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const preview = computeAmount(Number(hours) || 0, rate ? Number(rate) : null, null);

  const submit = async () => {
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("period", period); fd.set("hours", hours); fd.set("hourlyRate", rate); fd.set("note", note);
    if (file) fd.set("file", file);
    const res = await fetch("/api/timesheets/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({ ok: false, error: "Errore di rete" }));
    setBusy(false);
    if (j.ok) { setOpen(false); setPeriod(""); setHours(""); setRate(""); setNote(""); setFile(null); onDone(); }
    else setErr(j.error || "Errore");
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
        <Clock className="h-4 w-4" /> Invia foglio ore
      </button>
    );
  }

  const field = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
  const lbl = "text-[10px] uppercase tracking-wider text-[var(--color-muted)]";

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-[var(--color-accent)]" /><h2 className="text-sm font-semibold">Nuovo foglio ore</h2></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1"><span className={lbl}>Periodo</span><input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={field} /></label>
        <label className="flex flex-col gap-1"><span className={lbl}>Ore totali</span><input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="es. 82" className={field} /></label>
        <label className="flex flex-col gap-1"><span className={lbl}>Tariffa €/h (facolt.)</span><input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="numeric" placeholder="es. 25" className={field} /></label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className={lbl}>Nota (facolt.)</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. include stage di Pasqua" className={field} /></label>
        <label className="flex flex-col gap-1">
          <span className={lbl}>Allega Excel (facolt.)</span>
          <input type="file" accept=".xls,.xlsx,.csv,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs text-[var(--color-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-surface-2)] file:px-3 file:py-1.5 file:text-xs file:text-[var(--color-fg)]" />
        </label>
      </div>

      {preview != null && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)]/10 px-3 py-1.5 text-sm">
          <Euro className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Stipendio calcolato: <span className="num font-semibold">{money(preview, currency)}</span>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-[#f87171]">{err}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button disabled={busy || !period || !hours} onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          <Upload className="h-4 w-4" /> {busy ? "Invio…" : "Invia"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]">Annulla</button>
      </div>
    </div>
  );
}

function Row({ t, currency, canManage }: { t: TimesheetView; currency: string; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const meta = TS_STATUS_META[t.status as TimesheetStatus] ?? TS_STATUS_META.submitted;
  const act = (fn: () => Promise<{ ok: boolean }>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{periodLabel(t.period)}</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.label}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
          {t.coachName} · <span className="num">{t.hours}</span> ore{t.hourlyRate != null ? ` · ${money(t.hourlyRate, currency)}/h` : ""}{t.note ? ` · ${t.note}` : ""}
          {t.hasFile && <> · <a href={`/api/timesheets/${t.id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[var(--color-accent)]"><FileSpreadsheet className="h-3 w-3" />Excel</a></>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="num text-lg font-bold">{money(t.amount, currency)}</span>
        {canManage && (
          <div className="flex items-center gap-1">
            {t.status === "submitted" && <button disabled={pending} onClick={() => act(() => approveTimesheet(t.id))} className="rounded-md bg-[#3ecf8e] px-2.5 py-1 text-[11px] font-semibold text-[#0a0c10]">Approva</button>}
            {t.status === "approved" && <button disabled={pending} onClick={() => act(() => markTimesheetPaid(t.id))} className="rounded-md bg-[#7c9cff] px-2.5 py-1 text-[11px] font-semibold text-[#0a0c10]">Segna pagato</button>}
            {t.status === "paid" && <button disabled={pending} onClick={() => act(() => unmarkTimesheetPaid(t.id))} className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)]"><Check className="h-3 w-3" />Pagato</button>}
            <button disabled={pending} onClick={() => act(() => deleteTimesheet(t.id))} title="Elimina" className="rounded-md p-1.5 text-[var(--color-muted)] hover:text-[#ef5f6b]"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {!canManage && t.status !== "paid" && (
          <button disabled={pending} onClick={() => act(() => deleteTimesheet(t.id))} title="Elimina" className="rounded-md p-1.5 text-[var(--color-muted)] hover:text-[#ef5f6b]"><Trash2 className="h-3.5 w-3.5" /></button>
        )}
      </div>
    </div>
  );
}

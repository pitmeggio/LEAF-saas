"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IdCard, Save, Check } from "lucide-react";
import { updateAthleteAnagrafica } from "@/app/anagrafica-actions";
import { expiryStatus, EXPIRY_COLOR } from "@/lib/anagrafica/anagraficaTypes";

export type AnagraficaData = {
  codiceFiscale: string | null;
  fitTessera: string | null;
  fitTesseraExpiry: string | null; // ISO or null
  itfJuniorRef: string | null;
  ipinExpiry: string | null;
};

const DAY = 86_400_000;
function toInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}
function daysLeft(dateStr: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / DAY);
}

function ExpiryBadge({ dateStr }: { dateStr: string }) {
  const dl = daysLeft(dateStr);
  if (dl === null) return null;
  const st = expiryStatus(dl);
  if (st === "ok") return <span className="text-[10px] text-[var(--color-muted)]">valida · {dl}g</span>;
  const color = EXPIRY_COLOR[st];
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${color}22`, color }}>
      {st === "expired" ? "scaduta" : `scade tra ${dl}g`}
    </span>
  );
}

// Anagrafica editor on the athlete Canvas — Codice Fiscale + tessera FIT / iPin
// with renewal deadlines. Inline expiry badges give the segreteria an at-a-glance
// read; saving feeds the academy-wide scadenza alerts.
export function AnagraficaCard({ athleteId, accent, data }: { athleteId: string; accent: string; data: AnagraficaData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    codiceFiscale: data.codiceFiscale ?? "",
    fitTessera: data.fitTessera ?? "",
    fitTesseraExpiry: toInput(data.fitTesseraExpiry),
    itfJuniorRef: data.itfJuniorRef ?? "",
    ipinExpiry: toInput(data.ipinExpiry),
  });
  const set = (k: keyof typeof f, v: string) => { setF((p) => ({ ...p, [k]: v })); setSaved(false); };

  const save = () =>
    start(async () => {
      setErr(null);
      const r = await updateAthleteAnagrafica({ athleteId, ...f });
      if (r.ok) { setSaved(true); router.refresh(); } else setErr(r.error);
    });

  const field = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
  const lbl = "text-[10px] uppercase tracking-wider text-[var(--color-muted)]";

  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2">
        <IdCard className="h-4 w-4" style={{ color: accent }} />
        <h3 className="text-sm font-semibold">Anagrafica &amp; tesseramenti</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={lbl}>Codice Fiscale</span>
          <input value={f.codiceFiscale} onChange={(e) => set("codiceFiscale", e.target.value)} placeholder="RSSMRA10A01G224X" maxLength={16} className={`${field} font-mono uppercase`} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={lbl}>Tessera FIT — n°</span>
          <input value={f.fitTessera} onChange={(e) => set("fitTessera", e.target.value)} placeholder="es. 1234567" className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between"><span className={lbl}>Tessera FIT — scadenza</span>{f.fitTesseraExpiry && <ExpiryBadge dateStr={f.fitTesseraExpiry} />}</span>
          <input type="date" value={f.fitTesseraExpiry} onChange={(e) => set("fitTesseraExpiry", e.target.value)} className={field} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={lbl}>iPin ITF</span>
          <input value={f.itfJuniorRef} onChange={(e) => set("itfJuniorRef", e.target.value)} placeholder="es. AA12345" className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between"><span className={lbl}>iPin — scadenza</span>{f.ipinExpiry && <ExpiryBadge dateStr={f.ipinExpiry} />}</span>
          <input type="date" value={f.ipinExpiry} onChange={(e) => set("ipinExpiry", e.target.value)} className={field} />
        </label>
      </div>

      {err && <p className="mt-3 text-xs text-[#f87171]">{err}</p>}

      <button onClick={save} disabled={pending} className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-[#0a0c10] disabled:opacity-50" style={{ background: accent }}>
        {saved ? <><Check className="h-4 w-4" /> Salvato</> : <><Save className="h-4 w-4" /> {pending ? "Salvo…" : "Salva anagrafica"}</>}
      </button>
    </div>
  );
}

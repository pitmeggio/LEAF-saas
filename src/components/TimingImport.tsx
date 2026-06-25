"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { parseTimingCsv, matchRows, formatMs, type AthleteRef, type MatchedRow } from "@/lib/timingImport";
import { importTimingResults } from "@/app/timing-actions";

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-[11px] text-[var(--color-muted)]";
const DOT = { exact: "var(--color-accent)", fuzzy: "#f59e0b", none: "#f87171" } as const;

export function TimingImport({ athletes }: { athletes: AthleteRef[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [kind, setKind] = useState<"training" | "race">("training");
  const [discipline, setDiscipline] = useState("");
  const [location, setLocation] = useState("");
  const [rows, setRows] = useState<MatchedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function handleText(text: string, name: string) {
    setErr(null); setMsg(null);
    const res = parseTimingCsv(text);
    if (res.rows.length === 0) { setErr("Nessuna riga riconosciuta. Controlla che il file abbia un'intestazione con nome/atleta e i tempi."); setRows([]); return; }
    if (res.columns.name == null && res.columns.lastName == null) {
      setErr("Non ho trovato la colonna del nome atleta — controlla l'intestazione del file."); setRows([]); return;
    }
    setRows(matchRows(res.rows, athletes));
    setFileName(name);
  }
  async function onFile(file?: File | null) {
    if (!file) return;
    handleText(await file.text(), file.name);
  }
  const setMatch = (i: number, athleteId: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, athleteId: athleteId || null, confidence: athleteId ? (r.confidence === "none" ? "fuzzy" : r.confidence) : "none" } : r)));

  const matched = rows.filter((r) => r.athleteId).length;

  const doImport = () => {
    setErr(null);
    const payload = {
      date, kind,
      discipline: discipline || undefined,
      location: location || undefined,
      source: "csv",
      rows: rows.filter((r) => r.athleteId).map((r) => ({ athleteId: r.athleteId!, bib: r.bib, run1Ms: r.run1Ms, run2Ms: r.run2Ms, totalMs: r.totalMs, rank: r.rank })),
    };
    start(async () => {
      const res = await importTimingResults(payload);
      if (res.ok) { setMsg(`Importati ${res.count} risultati nei profili atleta.`); setRows([]); setFileName(""); if (fileRef.current) fileRef.current.value = ""; router.refresh(); }
      else setErr(res.error ?? "Errore durante l'import.");
    });
  };

  return (
    <div className="card p-5">
      {/* Session meta */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><label className={lbl}>Data *</label><input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div>
          <label className={lbl}>Tipo</label>
          <select className={inp} value={kind} onChange={(e) => setKind(e.target.value as "training" | "race")}>
            <option value="training">Allenamento</option>
            <option value="race">Gara</option>
          </select>
        </div>
        <div><label className={lbl}>Disciplina</label><input className={inp} value={discipline} onChange={(e) => setDiscipline(e.target.value)} placeholder="GS / SL …" /></div>
        <div><label className={lbl}>Luogo</label><input className={inp} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Hafjell" /></div>
      </div>

      {/* File picker */}
      <div className="mt-4">
        <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-6 text-sm text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
        >
          <Upload className="h-4 w-4" aria-hidden />
          {fileName ? <span className="text-[var(--color-fg)]">{fileName}</span> : "Carica il file del cronometro (CSV / TXT) — Microgate, Brower, Alge…"}
        </button>
      </div>

      {msg && <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--color-accent)]"><CheckCircle2 className="h-4 w-4" aria-hidden />{msg}</p>}
      {err && <p className="mt-3 text-sm text-[#f87171]">{err}</p>}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-[var(--color-muted)]" aria-hidden />
              <span className="font-medium">{rows.length} righe</span>
              <span className="text-[var(--color-muted)]">· {matched} abbinate{rows.length - matched > 0 ? ` · ${rows.length - matched} da controllare` : ""}</span>
            </div>
            <button
              type="button"
              disabled={pending || matched === 0}
              onClick={doImport}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
            >
              {pending ? "Importo…" : `Importa ${matched} risultati`}
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                <tr>
                  <th className="px-2 py-2 text-left">Pett</th>
                  <th className="px-2 py-2 text-left">Dal file</th>
                  <th className="px-2 py-2 text-right">R1</th>
                  <th className="px-2 py-2 text-right">R2</th>
                  <th className="px-2 py-2 text-right">Tot</th>
                  <th className="px-2 py-2 text-left">Atleta in LEAF</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="px-2 py-1.5 text-[var(--color-muted)]">{r.bib ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.name ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right num">{formatMs(r.run1Ms)}</td>
                    <td className="px-2 py-1.5 text-right num">{formatMs(r.run2Ms)}</td>
                    <td className="px-2 py-1.5 text-right num font-medium">{formatMs(r.totalMs)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[r.confidence] }} />
                        <select className={`${inp} py-1`} value={r.athleteId ?? ""} onChange={(e) => setMatch(i, e.target.value)}>
                          <option value="">— ignora —</option>
                          {athletes.map((a) => <option key={a.id} value={a.id}>{a.lastName} {a.firstName}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">
            <span className="text-[var(--color-accent)]">●</span> abbinato sicuro · <span className="text-[#f59e0b]">●</span> da confermare · <span className="text-[#f87171]">●</span> non abbinato (verrà saltato). Correggi col menu a tendina.
          </p>
        </div>
      )}
    </div>
  );
}

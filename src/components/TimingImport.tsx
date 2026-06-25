"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { parseTimingCsv, matchRows, formatMs, type AthleteRef, type MatchedRun } from "@/lib/timingImport";
import { importTimingResults } from "@/app/timing-actions";

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-[11px] text-[var(--color-muted)]";
const DOT = { exact: "var(--color-accent)", fuzzy: "#f59e0b", none: "#f87171" } as const;

const fmtSplits = (s: number[]) => (s.length ? s.map(formatMs).join(" / ") : "—");

export function TimingImport({ athletes }: { athletes: AthleteRef[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [kind, setKind] = useState<"training" | "race">("training");
  const [discipline, setDiscipline] = useState("");
  const [location, setLocation] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");
  const [dateHint, setDateHint] = useState("");
  const [runs, setRuns] = useState<MatchedRun[]>([]);
  const [fileName, setFileName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function handleText(text: string, name: string) {
    setErr(null); setMsg(null);
    const res = parseTimingCsv(text);
    if (!res.headerFound || res.runs.length === 0) {
      setErr("Non ho riconosciuto la tabella. Serve un'intestazione con il nome atleta e il tempo (Finish Time)."); setRuns([]); return;
    }
    if (res.meta.event) setDiscipline(res.meta.event);
    if (res.meta.hill) setLocation(res.meta.hill);
    if (res.meta.sessionLabel) setSessionLabel(res.meta.sessionLabel);
    setDateHint(res.meta.date ?? "");
    setRuns(matchRows(res.runs, athletes));
    setFileName(name);
  }
  async function onFile(file?: File | null) { if (file) handleText(await file.text(), file.name); }

  const setMatch = (i: number, athleteId: string) =>
    setRuns((p) => p.map((r, idx) => (idx === i ? { ...r, athleteId: athleteId || null, confidence: athleteId ? (r.confidence === "none" ? "fuzzy" : r.confidence) : "none" } : r)));

  const matched = runs.filter((r) => r.athleteId).length;
  const hasSplits = runs.some((r) => r.splitsMs.length > 0);

  const doImport = () => {
    setErr(null);
    const payload = {
      date, kind,
      discipline: discipline || undefined,
      location: location || undefined,
      sessionLabel: sessionLabel || undefined,
      source: "csv",
      runs: runs.filter((r) => r.athleteId).map((r) => ({ athleteId: r.athleteId!, bib: r.bib, runNumber: r.runNumber, finishMs: r.finishMs, splitsMs: r.splitsMs, status: r.status })),
    };
    start(async () => {
      const res = await importTimingResults(payload);
      if (res.ok) { setMsg(`Importati ${res.count} giri nei profili atleta.`); setRuns([]); setFileName(""); if (fileRef.current) fileRef.current.value = ""; router.refresh(); }
      else setErr(res.error ?? "Errore durante l'import.");
    });
  };

  return (
    <div className="card p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className={lbl}>Data *</label>
          <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
          {dateHint && <div className="mt-1 text-[10px] text-[var(--color-muted)]">dal file: {dateHint}</div>}
        </div>
        <div>
          <label className={lbl}>Tipo</label>
          <select className={inp} value={kind} onChange={(e) => setKind(e.target.value as "training" | "race")}>
            <option value="training">Allenamento</option>
            <option value="race">Gara</option>
          </select>
        </div>
        <div><label className={lbl}>Disciplina</label><input className={inp} value={discipline} onChange={(e) => setDiscipline(e.target.value)} placeholder="GS / SL …" /></div>
        <div><label className={lbl}>Luogo</label><input className={inp} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="T-bar" /></div>
      </div>

      <div className="mt-4">
        <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-6 text-sm text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]">
          <Upload className="h-4 w-4" aria-hidden />
          {fileName ? <span className="text-[var(--color-fg)]">{fileName}</span> : "Carica il file del cronometro (CSV / TXT) — Split Second, Brower, Microgate, Alge…"}
        </button>
        {sessionLabel && runs.length > 0 && <div className="mt-2 text-[11px] text-[var(--color-muted)]">{sessionLabel}</div>}
      </div>

      {msg && <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--color-accent)]"><CheckCircle2 className="h-4 w-4" aria-hidden />{msg}</p>}
      {err && <p className="mt-3 text-sm text-[#f87171]">{err}</p>}

      {runs.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-[var(--color-muted)]" aria-hidden />
              <span className="font-medium">{runs.length} giri</span>
              <span className="text-[var(--color-muted)]">· {matched} abbinati{runs.length - matched > 0 ? ` · ${runs.length - matched} da controllare` : ""}</span>
            </div>
            <button type="button" disabled={pending || matched === 0} onClick={doImport}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
              {pending ? "Importo…" : `Importa ${matched} giri`}
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                <tr>
                  <th className="px-2 py-2 text-left">Pett</th>
                  <th className="px-2 py-2 text-left">Dal file</th>
                  <th className="px-2 py-2 text-center">Giro</th>
                  {hasSplits && <th className="px-2 py-2 text-right">Intermedi</th>}
                  <th className="px-2 py-2 text-right">Tempo</th>
                  <th className="px-2 py-2 text-left">Atleta in LEAF</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="px-2 py-1.5 text-[var(--color-muted)]">{r.bib ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.name ?? "—"}</td>
                    <td className="px-2 py-1.5 text-center text-[var(--color-muted)]">{r.runNumber ?? "—"}</td>
                    {hasSplits && <td className="px-2 py-1.5 text-right num text-[11px] text-[var(--color-muted)]">{fmtSplits(r.splitsMs)}</td>}
                    <td className="px-2 py-1.5 text-right num font-medium">{r.status && r.finishMs == null ? r.status : formatMs(r.finishMs)}</td>
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
            <span className="text-[var(--color-accent)]">●</span> abbinato sicuro · <span className="text-[#f59e0b]">●</span> da confermare · <span className="text-[#f87171]">●</span> non abbinato (saltato). Un atleta può avere più giri.
          </p>
        </div>
      )}
    </div>
  );
}

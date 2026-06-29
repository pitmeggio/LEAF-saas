"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  importTennisRanking,
  addTennisRankingManual,
  clearTennisRankings,
} from "@/app/tennis-ranking-actions";
import { SOURCE_META, type AthleteTennisRankings, type RankSummary, type TennisRankingSource } from "@/lib/tennis/ranking";

const SOURCES: TennisRankingSource[] = ["FIT", "ITF", "ATP", "WTA"];

export function TennisRankingCard({
  athleteId, accent, data, mode,
}: {
  athleteId: string; accent: string; data: AthleteTennisRankings; mode: "live" | "simulated";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<null | "import" | "manual">(data.hasAny ? null : "manual");
  const [err, setErr] = useState<string | null>(null);

  // import form
  const [impSource, setImpSource] = useState<TennisRankingSource>("FIT");
  const [impCode, setImpCode] = useState(data.codes.fitTessera ?? "");

  // manual form
  const [mSource, setMSource] = useState<TennisRankingSource>("FIT");
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));
  const [mClassifica, setMClassifica] = useState("");
  const [mRank, setMRank] = useState("");
  const [mPoints, setMPoints] = useState("");
  const [mCategory, setMCategory] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => { setErr(null); const r = await fn(); if (r.ok) { after?.(); router.refresh(); } else setErr(r.error ?? "Errore."); });

  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5 backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="kicker mb-1">Classifica & ranking</div>
          <h2 className="text-xl font-semibold">
            <span className="opacity-80">Traiettoria</span>{" "}
            <span className="opacity-60" style={{ color: accent }}>FIT · ITF · ATP</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setPanel(panel === "import" ? null : "import"); setErr(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs hover:border-[var(--color-accent)]">
            <Download className="h-3.5 w-3.5" /> Importa da codice
          </button>
          <button onClick={() => { setPanel(panel === "manual" ? null : "manual"); setErr(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0a0c10]" style={{ background: accent }}>
            <Plus className="h-3.5 w-3.5" /> Aggiungi
          </button>
        </div>
      </div>

      {/* Current rankings */}
      {data.hasAny ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.summaries.map((sm) => <RankTile key={sm.source} sm={sm} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">
          Nessuna classifica ancora. Importa dal codice federazione o aggiungi la classifica FIT a mano.
        </div>
      )}

      {/* Import panel */}
      {panel === "import" && (
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold">Importa da codice atleta</span>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${mode === "live" ? "bg-[var(--color-accent)] text-[#0a0c10]" : "bg-[#f59e0b] text-[#0a0c10]"}`}>
              {mode === "live" ? "Live" : "Demo"}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Federazione">
              <select value={impSource} onChange={(e) => setImpSource(e.target.value as TennisRankingSource)} className={inp}>
                {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_META[s].label} — {SOURCE_META[s].full}</option>)}
              </select>
            </Field>
            <Field label={impSource === "FIT" ? "Tessera FIT" : impSource === "ITF" ? "ITF Junior ref" : "Player ID"}>
              <input value={impCode} onChange={(e) => setImpCode(e.target.value)} placeholder="es. 1234567" className={inp} />
            </Field>
            <button disabled={pending || !impCode.trim()} onClick={() => run(() => importTennisRanking({ athleteId, source: impSource, code: impCode.trim() }))}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[#0a0c10] disabled:opacity-50" style={{ background: accent }}>
              {pending ? "Importo…" : "Importa"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">
            {mode === "live"
              ? "Recupera lo storico classifica direttamente dalla federazione."
              : "Connettore live ITF/FIT non ancora attivo: questo import genera dati dimostrativi per mostrare il flusso. Per i dati reali usa “Aggiungi”."}
          </p>
        </div>
      )}

      {/* Manual panel */}
      {panel === "manual" && (
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-4">
          <div className="mb-3 text-xs font-semibold">Aggiungi classifica (dato reale)</div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Federazione">
              <select value={mSource} onChange={(e) => setMSource(e.target.value as TennisRankingSource)} className={inp}>
                {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_META[s].label}</option>)}
              </select>
            </Field>
            <Field label="Data">
              <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} className={inp} />
            </Field>
            {mSource === "FIT" ? (
              <Field label="Classifica">
                <input value={mClassifica} onChange={(e) => setMClassifica(e.target.value)} placeholder="es. 2.6" className={`${inp} w-24`} />
              </Field>
            ) : (
              <>
                <Field label="Posizione">
                  <input value={mRank} onChange={(e) => setMRank(e.target.value)} placeholder="#" inputMode="numeric" className={`${inp} w-24`} />
                </Field>
                <Field label="Punti">
                  <input value={mPoints} onChange={(e) => setMPoints(e.target.value)} placeholder="pt" inputMode="numeric" className={`${inp} w-24`} />
                </Field>
              </>
            )}
            <button disabled={pending} onClick={() => run(
              () => addTennisRankingManual({
                athleteId, source: mSource, date: mDate,
                classifica: mSource === "FIT" ? mClassifica.trim() : null,
                rank: mSource !== "FIT" && mRank ? Number(mRank) : null,
                points: mSource !== "FIT" && mPoints ? Number(mPoints) : null,
                category: mCategory.trim() || null,
              }),
              () => { setMClassifica(""); setMRank(""); setMPoints(""); },
            )}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[#0a0c10] disabled:opacity-50" style={{ background: accent }}>
              {pending ? "Salvo…" : "Salva"}
            </button>
          </div>
        </div>
      )}

      {err && <p className="mt-3 text-xs text-[#f87171]">{err}</p>}

      {/* Demo-data cleanup */}
      {data.summaries.some((s) => s.origin.startsWith("import:demo")) && (
        <button disabled={pending} onClick={() => run(() => clearTennisRankings(athleteId).then((r) => ({ ok: r.ok })))}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted)] hover:text-[#f87171] disabled:opacity-50">
          <Trash2 className="h-3 w-3" /> Rimuovi dati dimostrativi
        </button>
      )}
    </div>
  );
}

function RankTile({ sm }: { sm: RankSummary }) {
  const meta = SOURCE_META[sm.source];
  const improved = sm.rankDelta != null ? sm.rankDelta < 0 : sm.classificaSteps != null ? sm.classificaSteps > 0 : null;
  const deltaText = sm.source === "FIT"
    ? (sm.classificaSteps && sm.classificaSteps !== 0 ? `${Math.abs(sm.classificaSteps)} ${Math.abs(sm.classificaSteps) === 1 ? "passo" : "passi"}` : "stabile")
    : (sm.rankDelta && sm.rankDelta !== 0 ? `${Math.abs(sm.rankDelta)}` : "stabile");
  const big = sm.source === "FIT" ? (sm.latest.classifica ?? "—") : (sm.latest.rank != null ? `#${sm.latest.rank}` : "—");
  const sub = sm.source === "FIT"
    ? (sm.latest.category ?? meta.full)
    : (sm.latest.points != null ? `${sm.latest.points} pt` : meta.full);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.color }} />{meta.label}
        </span>
        {sm.origin.startsWith("import:demo") && <span className="rounded-full bg-[#f59e0b]/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#f59e0b]">Demo</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="num text-3xl font-bold leading-none">{big}</span>
        {improved != null && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${improved ? "text-[var(--color-accent)]" : deltaText === "stabile" ? "text-[var(--color-muted)]" : "text-[#f87171]"}`}>
            {deltaText === "stabile" ? <Minus className="h-3 w-3" /> : improved ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {deltaText}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{sub}</div>
      <Spark series={sm.series} color={meta.color} kind={meta.kind} />
    </div>
  );
}

// Sparkline. For rank/ladder, "better" = smaller, so we invert the y-axis: an
// improving athlete's line always climbs.
function Spark({ series, color, kind }: { series: RankSummary["series"]; color: string; kind: "classifica" | "rank" }) {
  const FIT_LADDER = ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "3.1", "3.2", "3.3", "3.4", "3.5", "4.1", "4.2", "4.3", "4.NC"];
  const vals = series.map((p) => kind === "classifica"
    ? (p.classifica ? FIT_LADDER.indexOf(p.classifica) : null)
    : p.rank).filter((v): v is number => v != null && v >= 0);
  if (vals.length < 2) return <div className="mt-3 h-8" />;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const W = 120, H = 32;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = ((v - min) / span) * (H - 4) + 2; // smaller value (better) → smaller y → higher line
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-8 w-full" preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.5" fill={color} />
    </svg>
  );
}

const inp = "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}

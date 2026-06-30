"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Upload, Trash2, ExternalLink, Download, Users, X,
  ClipboardCheck, Trophy, Dumbbell, HeartPulse, Video, Search, File as FileIcon, type LucideIcon,
} from "lucide-react";
import { addAthleteEntry, deleteAthleteFile } from "@/app/tennis-dossier-actions";
import { CATEGORY_META, CATEGORY_ORDER, type AthleteDossier, type DossierCategory, type DossierFile } from "@/lib/tennis/dossierTypes";

const ICON: Record<DossierCategory, LucideIcon> = {
  evaluation: ClipboardCheck, match_report: Trophy, physical: Dumbbell,
  medical: HeartPulse, video: Video, scouting: Search, file: FileIcon,
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmtSize = (b: number | null) => (b == null ? "" : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function StaffDossier({
  athleteId, athleteName, accent, data,
}: {
  athleteId: string; athleteName: string; accent: string; data: AthleteDossier;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5 backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="kicker mb-1">Dossier dello staff</div>
          <h2 className="text-xl font-semibold">
            <span className="opacity-80">Tutto su {athleteName},</span>{" "}
            <span className="opacity-60" style={{ color: accent }}>in un posto solo</span>
          </h2>
          <p className="mt-1 max-w-xl text-xs text-[var(--color-muted)]">
            Maestri, preparatori, fisio: ognuno carica i suoi file e le sue schede. Tutto lo staff legge la stessa storia — niente più file sparsi.
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#0a0c10]" style={{ background: accent }}>
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? "Chiudi" : "Aggiungi al dossier"}
        </button>
      </div>

      {/* Contributors + counts */}
      {data.total > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--color-muted)]">
          <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{data.contributors.length} contributor{data.contributors.length === 1 ? "" : "s"}: {data.contributors.join(", ")}</span>
          {CATEGORY_ORDER.filter((c) => data.countByCategory[c]).map((c) => (
            <span key={c} className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: CATEGORY_META[c].color }} />{CATEGORY_META[c].label} · {data.countByCategory[c]}</span>
          ))}
        </div>
      )}

      {open && <AddPanel athleteId={athleteId} accent={accent} onDone={() => { setOpen(false); router.refresh(); }} />}

      {/* Performance trend */}
      {data.evaluationSeries.length >= 2 && <Trend series={data.evaluationSeries} accent={accent} />}

      {/* Timeline feed */}
      {data.files.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
          Nessun file ancora. Carica la prima scheda valutativa, un referto partita o un video.
        </div>
      ) : (
        <ul className="space-y-2">
          {data.files.map((f) => <Row key={f.id} f={f} onDelete={() => deleteAthleteFile(f.id).then(() => router.refresh())} />)}
        </ul>
      )}
    </div>
  );
}

function Row({ f, onDelete }: { f: DossierFile; onDelete: () => void }) {
  const meta = CATEGORY_META[f.category];
  const Icon = ICON[f.category];
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${meta.color}22`, color: meta.color }}>
        <Icon className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{f.title}</span>
          <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.label}</span>
          {f.score != null && (
            <span className="shrink-0 num rounded-full bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">
              {f.score}{f.scoreScale ? `/${f.scoreScale}` : ""}
            </span>
          )}
        </div>
        {f.note && <div className="mt-0.5 truncate text-xs text-[var(--color-fg)]/70">{f.note}</div>}
        <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">
          {f.authorRole ? `${f.authorRole} · ` : ""}{f.authorName} · {fmtDate(f.observedAt)}{f.fileName ? ` · ${f.fileName}${f.fileSize ? ` (${fmtSize(f.fileSize)})` : ""}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {f.hasBinary && (
          <a href={`/api/athlete-files/${f.id}/file`} target="_blank" rel="noopener noreferrer"
            className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]" title="Apri / scarica">
            <Download className="h-4 w-4" />
          </a>
        )}
        {!f.hasBinary && f.fileUrl && (
          <a href={f.fileUrl} target="_blank" rel="noopener noreferrer"
            className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]" title="Apri link">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button disabled={pending} onClick={() => start(onDelete)}
          className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:border-[#f87171] hover:text-[#f87171] disabled:opacity-50" title="Elimina">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function Trend({ series, accent }: { series: AthleteDossier["evaluationSeries"]; accent: string }) {
  const W = 560, H = 110, padX = 8, padY = 14;
  const vals = series.map((p) => p.value);
  const min = Math.min(...vals, 0), max = Math.max(...vals, 10);
  const span = max - min || 1;
  const xs = (i: number) => padX + (i / (series.length - 1)) * (W - padX * 2);
  const ys = (v: number) => padY + (1 - (v - min) / span) * (H - padY * 2);
  const line = series.map((p, i) => `${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`);
  const last = series[series.length - 1];
  const first = series[0];
  const delta = Math.round((last.value - first.value) * 10) / 10;

  return (
    <div className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4">
      <div className="mb-2 flex items-end justify-between">
        <div>
          <div className="kicker">Andamento valutazioni</div>
          <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">media normalizzata su 10 · {series.length} valutazioni</div>
        </div>
        <div className="text-right">
          <span className="num text-2xl font-bold" style={{ color: accent }}>{last.value}</span>
          <span className="text-sm text-[var(--color-muted)]">/10</span>
          <div className={`text-[11px] font-semibold ${delta > 0 ? "text-[var(--color-accent)]" : delta < 0 ? "text-[#f87171]" : "text-[var(--color-muted)]"}`}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} {delta > 0 ? "+" : ""}{delta} sulla stagione
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" preserveAspectRatio="none">
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={padX} x2={W - padX} y1={padY + t * (H - padY * 2)} y2={padY + t * (H - padY * 2)} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3 4" />
        ))}
        <polyline points={line.join(" ")} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {series.map((p, i) => <circle key={i} cx={xs(i)} cy={ys(p.value)} r="3" fill={accent} />)}
      </svg>
    </div>
  );
}

// Default quick-eval criteria. NOT an imposed schema — just a fast option for a
// coach who hasn't got their own sheet; "Carica file" stays the primary path.
const QUICK_CRITERIA = ["Dritto", "Rovescio", "Servizio", "Risposta", "Fisico", "Mentale"];

// Combined add panel: a quick structured eval, OR upload a file (→ route), OR
// paste a link / log a single score (→ server action).
function AddPanel({ athleteId, accent, onDone }: { athleteId: string; accent: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"file" | "quick">("file");

  const [category, setCategory] = useState<DossierCategory>("evaluation");
  const [title, setTitle] = useState("");
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 10));
  const [authorRole, setAuthorRole] = useState("");
  const [note, setNote] = useState("");
  const [score, setScore] = useState("");
  const [scale, setScale] = useState("10");
  const [link, setLink] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [crit, setCrit] = useState<Record<string, string>>({});

  async function submit() {
    setErr(null);

    // Quick structured evaluation → one evaluation entry (no file).
    if (mode === "quick") {
      const vals = QUICK_CRITERIA.map((c) => Number(crit[c] || 0)).filter((v) => v > 0);
      if (vals.length === 0) { setErr("Dai almeno un voto."); return; }
      const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
      const breakdown = QUICK_CRITERIA.filter((c) => crit[c]).map((c) => `${c} ${crit[c]}`).join(" · ");
      const fullNote = [breakdown, note.trim()].filter(Boolean).join(" — ");
      start(async () => {
        const r = await addAthleteEntry({
          athleteId, category: "evaluation", title: title.trim() || "Scheda valutativa",
          note: fullNote || null, authorRole: authorRole.trim() || null, observedAt,
          score: avg, scoreScale: 10, fileUrl: null,
        });
        if (r.ok) onDone(); else setErr(r.error);
      });
      return;
    }

    const file = fileRef.current?.files?.[0] ?? null;
    if (!file && !title.trim()) { setErr("Inserisci un titolo (o scegli un file)."); return; }

    if (file) {
      setBusy(true);
      const fd = new FormData();
      fd.set("athleteId", athleteId); fd.set("category", category); fd.set("title", title.trim());
      fd.set("note", note.trim()); fd.set("authorRole", authorRole.trim()); fd.set("observedAt", observedAt);
      if (score.trim()) { fd.set("score", score.trim()); fd.set("scoreScale", scale.trim() || "10"); }
      fd.set("file", file);
      try {
        const res = await fetch("/api/athlete-files/upload", { method: "POST", body: fd });
        const j = await res.json();
        if (j.ok) onDone(); else setErr(j.error ?? "Errore upload.");
      } catch { setErr("Errore di rete durante l'upload."); }
      finally { setBusy(false); }
    } else {
      start(async () => {
        const r = await addAthleteEntry({
          athleteId, category, title: title.trim(), note: note.trim() || null,
          authorRole: authorRole.trim() || null, observedAt,
          score: score.trim() ? Number(score) : null, scoreScale: score.trim() ? Number(scale) || 10 : null,
          fileUrl: link.trim() || null,
        });
        if (r.ok) onDone(); else setErr(r.error);
      });
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-4">
      {/* Mode toggle */}
      <div className="mb-3 inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-xs">
        <button onClick={() => setMode("file")} className="rounded-md px-3 py-1.5 font-medium" style={mode === "file" ? { background: accent, color: "#0a0c10" } : { color: "var(--color-muted)" }}>Carica file / link</button>
        <button onClick={() => setMode("quick")} className="rounded-md px-3 py-1.5 font-medium" style={mode === "quick" ? { background: accent, color: "#0a0c10" } : { color: "var(--color-muted)" }}>Scheda rapida</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mode === "file" && (
          <Field label="Tipo">
            <select value={category} onChange={(e) => setCategory(e.target.value as DossierCategory)} className={inp}>
              {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Titolo">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. Valutazione tecnica giugno" className={inp} />
        </Field>
        <Field label="Data osservazione">
          <input type="date" value={observedAt} onChange={(e) => setObservedAt(e.target.value)} className={inp} />
        </Field>
        <Field label="Tuo ruolo (opzionale)">
          <input value={authorRole} onChange={(e) => setAuthorRole(e.target.value)} placeholder="es. Preparatore atletico" className={inp} />
        </Field>
        {mode === "file" && (
          <>
            <Field label="Punteggio (opzionale)">
              <div className="flex items-center gap-1">
                <input value={score} onChange={(e) => setScore(e.target.value)} placeholder="8" inputMode="decimal" className={`${inp} w-16`} />
                <span className="text-[var(--color-muted)]">/</span>
                <input value={scale} onChange={(e) => setScale(e.target.value)} placeholder="10" inputMode="numeric" className={`${inp} w-16`} />
              </div>
            </Field>
            <Field label="Link (alternativa al file)">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive… / youtube…" className={inp} />
            </Field>
          </>
        )}
      </div>

      {/* Quick structured evaluation — coach scores a few criteria 1–10 */}
      {mode === "quick" && (
        <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Voti 1–10 — la media diventa il punteggio del trend</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {QUICK_CRITERIA.map((c) => (
              <label key={c} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 px-3 py-2">
                <span className="text-xs">{c}</span>
                <input value={crit[c] ?? ""} onChange={(e) => setCrit((p) => ({ ...p, [c]: e.target.value }))} placeholder="–" inputMode="numeric" className="w-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-center text-sm outline-none focus:border-[var(--color-accent)]" />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <Field label="Nota per lo staff (opzionale)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Cosa devono sapere gli altri: punti deboli, contesto, prossimi step…" className={`${inp} w-full resize-none`} />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {mode === "file" ? (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)]">
            <Upload className="h-4 w-4" />
            {fileName ?? "Carica la tua scheda (PDF, Excel, Word, immagine)"}
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.heic"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
          </label>
        ) : <span className="text-[11px] text-[var(--color-muted)]">Valutazione strutturata · senza file</span>}
        <button disabled={pending || busy} onClick={submit}
          className="rounded-lg px-5 py-2 text-sm font-semibold text-[#0a0c10] disabled:opacity-50" style={{ background: accent }}>
          {pending || busy ? "Salvo…" : "Salva nel dossier"}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-[#f87171]">{err}</p>}
    </div>
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

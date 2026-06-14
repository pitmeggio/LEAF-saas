"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createProgram, updateProgram, type ProgramInput } from "@/app/program-actions";
import { programSections, programKindLabel, type LineupRow, type ProgramKind } from "@/lib/trainingProgram";

type Group = { id: string; name: string };
type GroupAthletes = Record<string, { id: string; name: string }[]>;
type Initial = {
  id: string; kind: string; title: string | null; place: string | null; discipline: string | null;
  date: string; groupId: string | null; fields: Record<string, string>; lineup: LineupRow[];
};

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-[11px] text-[var(--color-muted)]";

// Coach builds the training / race programme (the WhatsApp Excel, now in LEAF).
// Self-contained portal modal. Picking a group fills the lineup with that
// group's athletes so the coach just types each one's goal.
export function ProgramFormButton({
  groups, groupAthletes, initial, label, className,
}: {
  groups: Group[]; groupAthletes: GroupAthletes; initial?: Initial; label: React.ReactNode; className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const [kind, setKind] = useState<ProgramKind>((initial?.kind as ProgramKind) || "training");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [place, setPlace] = useState(initial?.place ?? "");
  const [discipline, setDiscipline] = useState(initial?.discipline ?? "");
  const [groupId, setGroupId] = useState(initial?.groupId ?? "");
  const [fields, setFields] = useState<Record<string, string>>(initial?.fields ?? {});
  const [lineup, setLineup] = useState<LineupRow[]>(initial?.lineup ?? []);

  const sections = useMemo(() => programSections(kind), [kind]);
  const setField = (k: string, v: string) => setFields((p) => ({ ...p, [k]: v }));

  // When the group changes (and we're not editing an existing lineup), seed the
  // lineup from the group roster — one row per athlete, goals empty.
  const onGroup = (gid: string) => {
    setGroupId(gid);
    const roster = groupAthletes[gid] ?? [];
    setLineup((prev) => {
      const byId = new Map(prev.map((r) => [r.athleteId, r]));
      return roster.map((a, i) => byId.get(a.id) ?? { bib: String(i + 1), athleteId: a.id, name: a.name, goals: "" });
    });
  };
  const setLine = (i: number, patch: Partial<LineupRow>) => setLineup((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const close = () => { setOpen(false); setErr(null); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!date) { setErr("Scegli una data"); return; }
    const payload: ProgramInput = { kind, title: title || undefined, place: place || undefined, discipline: discipline || undefined, date, groupId: groupId || undefined, fields, lineup };
    start(async () => {
      const r = initial ? await updateProgram(initial.id, payload) : await createProgram(payload);
      if (r.ok) { close(); router.refresh(); } else setErr(r.error ?? "Errore");
    });
  };

  if (!open) return <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>;

  const overlay = (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <div className="flex min-h-full items-start justify-center py-8">
        <div className="card w-full max-w-2xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{initial ? "Modifica programma" : "Nuovo programma"}</h3>
            <button onClick={close} aria-label="Close" className="text-lg text-[var(--color-muted)]">✕</button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {/* Kind + header */}
            <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
              {(["training", "race"] as ProgramKind[]).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${kind === k ? "bg-[var(--color-accent)] text-[#0a0c10]" : "text-[var(--color-muted)]"}`}>
                  {k === "training" ? "🎿 Allenamento" : "🏁 Gara"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Data *</label><input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} required /></div>
              <div><label className={lbl}>Gruppo</label><select className={inp} value={groupId} onChange={(e) => onGroup(e.target.value)}><option value="">— gruppo —</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
              <div><label className={lbl}>Place</label><input className={inp} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Hafjell" /></div>
              <div><label className={lbl}>Discipline</label><input className={inp} value={discipline} onChange={(e) => setDiscipline(e.target.value)} placeholder="SL / GS …" /></div>
              <div className="col-span-2"><label className={lbl}>Titolo (opzionale)</label><input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. Camp Saas-Fee giorno 1" /></div>
            </div>

            {/* Template sections */}
            {sections.map((sec) => (
              <div key={sec.title}>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">{sec.title}</div>
                <div className="grid grid-cols-2 gap-2">
                  {sec.rows.map((row) => (
                    <div key={row.key}>
                      <label className={lbl}>{row.label}</label>
                      <input className={inp} value={fields[row.key] ?? ""} onChange={(e) => setField(row.key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Lineup — athletes + goals */}
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">{kind === "race" ? "Bibs gara · obiettivi" : "Atleti · obiettivi"}</div>
              {lineup.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">Scegli un gruppo per caricare gli atleti.</p>
              ) : (
                <div className="space-y-1.5">
                  {lineup.map((r, i) => (
                    <div key={r.athleteId ?? i} className="grid grid-cols-[48px_1fr_2fr] items-center gap-2">
                      <input className={`${inp} px-2 text-center`} value={r.bib} onChange={(e) => setLine(i, { bib: e.target.value })} placeholder="#" />
                      <span className="truncate text-sm">{r.name}</span>
                      <input className={inp} value={r.goals} onChange={(e) => setLine(i, { goals: e.target.value })} placeholder="obiettivo della giornata" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {err && <p className="text-sm text-[#f87171]">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]">Annulla</button>
              <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
                {pending ? "Salvo…" : "Salva bozza"}
              </button>
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">Salvi la bozza, poi <span className="font-medium">Pubblica</span> dalla lista — gli atleti del gruppo ricevono l&apos;avviso nell&apos;app.</p>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {mounted && createPortal(overlay, document.body)}
    </>
  );
}

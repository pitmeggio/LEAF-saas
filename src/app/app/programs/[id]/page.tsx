import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAthleteId } from "@/lib/auth";
import { getAthleteProgram, myLineupRow } from "@/lib/programs";
import { programSections, programKindLabel, type LineupRow } from "@/lib/trainingProgram";
import { fmtDate } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const metadata = { title: "Programma — LEAF" };

export default async function AppProgram({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athleteId = await requireAthleteId();
  const p = await getAthleteProgram(id, athleteId);
  if (!p) notFound();

  const kind = p.kind === "race" ? "race" : "training";
  const fields = (p.fields ?? {}) as Record<string, string>;
  const sections = programSections(kind);
  const lineup = Array.isArray(p.lineup) ? (p.lineup as unknown as LineupRow[]) : [];
  const mine = myLineupRow(p.lineup, athleteId);

  return (
    <div className="px-5 pt-5">
      <Link href="/app/training" className="text-xs text-[var(--color-muted)]">← Allenamenti</Link>

      {/* Header */}
      <div className="mt-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {kind === "race" ? "🏁 Gara" : "🎿 Allenamento"}
          </span>
          <span className="text-xs text-[var(--color-muted)]">{fmtDate(p.date)}</span>
        </div>
        <h1 className="mt-1 text-xl font-bold">{p.title || p.place || programKindLabel(kind)}</h1>
        {(p.place || p.discipline) && (
          <div className="text-xs text-[var(--color-muted)]">{[p.place, p.discipline].filter(Boolean).join(" · ")}</div>
        )}
      </div>

      {/* Your line — bib + goal */}
      {mine && (
        <div className="card mb-4 p-4" style={{ borderColor: "color-mix(in srgb, var(--color-accent) 45%, var(--color-border))" }}>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Il tuo {kind === "race" ? "pettorale" : "numero"}</div>
          <div className="mt-0.5 flex items-baseline gap-3">
            <span className="num text-2xl font-bold">{mine.bib || "—"}</span>
            {mine.goals && <span className="text-sm text-[var(--color-fg)]/85">🎯 {mine.goals}</span>}
          </div>
        </div>
      )}

      {/* Template fields — only filled rows */}
      {sections.map((sec) => {
        const rows = sec.rows.filter((r) => (fields[r.key] ?? "").trim());
        if (rows.length === 0) return null;
        return (
          <div key={sec.title} className="card mb-3 p-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">{sec.title}</div>
            <dl className="space-y-1.5 text-sm">
              {rows.map((r) => (
                <div key={r.key} className="flex justify-between gap-3">
                  <dt className="text-[var(--color-muted)]">{r.label}</dt>
                  <dd className="text-right">{fields[r.key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}

      {/* Full lineup */}
      {lineup.length > 0 && (
        <div className="card mb-4 overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-semibold">Squadra</div>
          <div className="divide-y divide-[var(--color-border)]">
            {lineup.map((r, i) => (
              <div key={r.athleteId ?? i} className={`flex items-center gap-3 px-4 py-2.5 ${r.athleteId === athleteId ? "bg-[var(--color-surface-2)]" : ""}`}>
                <span className="num w-7 text-center text-sm font-semibold text-[var(--color-muted)]">{r.bib || "—"}</span>
                <span className="flex-1 text-sm">{r.name}</span>
                {r.goals && <span className="max-w-[55%] truncate text-[11px] text-[var(--color-muted)]">{r.goals}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

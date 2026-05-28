import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAcademyId } from "@/lib/auth";
import { getAthleteCanvas } from "@/lib/tennisCanvas";
import { SeasonArc } from "@/components/SeasonArc";
import { SeasonSchedule } from "@/components/SeasonSchedule";
import { AiCopilotLeaf } from "@/components/AiCopilotLeaf";

export const dynamic = "force-dynamic";

// LEAF OS Professional Tennis — Athlete Canvas.
//
// Full-bleed cinematic surface that turns a tennis athlete's season into a
// story instead of a database view. Hero with name in display typography,
// ranking trajectory drawn as a custom SVG curve, prossimi tornei as oversized
// countdown cards, AI co-pilot leaf in the corner. Sub-component: SeasonArc
// — a custom 12-month SVG with training-phase bands + tournament nodes.
//
// Everything sport-gated: this route is meaningful only for sport=tennis
// academies. Ski tenants never reach here.
export default async function AthleteCanvasPage({ params }: { params: Promise<{ athleteId: string }> }) {
  await requireAcademyId();
  const { athleteId } = await params;
  const canvas = await getAthleteCanvas(athleteId);
  if (!canvas) notFound();

  const { athlete, academy, season, entries, phaseBands, upcoming, totals, narrative } = canvas;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06070a] text-[var(--color-fg)]">
      {/* Ambient mesh background — multi-layer gradient blobs for depth */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -left-32 -top-32 h-[460px] w-[460px] rounded-full opacity-50 blur-3xl"
          style={{ background: `radial-gradient(circle at 30% 30%, ${academy.logoColor}30, transparent 60%)` }}
        />
        <div
          className="absolute right-[-180px] top-1/3 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
          style={{ background: `radial-gradient(circle at 60% 40%, #7cff6b25, transparent 60%)` }}
        />
        <div className="absolute inset-0 grid-bg opacity-30" />
      </div>

      {/* Top nav micro-strip */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5">
        <Link
          href="/dashboard/canvas"
          className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          ← Canvas index
        </Link>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
          <span className="inline-flex h-2 w-2 rounded-full" style={{ background: academy.logoColor }} />
          {academy.name} · Season {season}
        </div>
      </div>

      {/* HERO — display typography + ranking + trajectory */}
      <section className="relative z-10 px-8 pt-6 md:px-14">
        <div className="kicker mb-2 text-[10px]" style={{ color: academy.logoColor }}>
          Athlete Canvas · LEAF OS Professional Tennis
        </div>

        <div className="flex flex-col-reverse gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            {/* Name display — gigantic, breathing line-height */}
            <h1
              className="font-bold leading-[0.95] tracking-[-0.04em]"
              style={{ fontSize: "clamp(3.5rem, 8.5vw, 7.5rem)" }}
            >
              <span className="block opacity-95">{athlete.firstName}</span>
              <span
                className="block opacity-60"
                style={{ color: academy.logoColor }}
              >
                {athlete.lastName}
              </span>
            </h1>

            {/* Subtitle: ATP rank ticker + nationality + age */}
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-3 py-1.5 backdrop-blur">
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Nationality</span>
                <span className="font-semibold">{athlete.nationality}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-3 py-1.5 backdrop-blur">
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Age</span>
                <span className="font-semibold">{athlete.age}</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-3 py-1.5 backdrop-blur">
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Sport</span>
                <span className="font-semibold capitalize">{athlete.sport}</span>
              </div>
            </div>

            {/* Narrative one-liner — coach-language summary */}
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--color-fg)]/80 md:text-lg">
              {narrative}
            </p>
          </div>

          {/* Ranking ticker — big number, mock for now (provider hook later) */}
          <div className="relative">
            <div className="kicker text-[10px]">ATP / ITF Ranking</div>
            <div
              className="display num font-bold leading-none tracking-tight"
              style={{ fontSize: "clamp(3rem, 6vw, 5.5rem)" }}
            >
              –
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              live sync · ATP feed pending
            </div>
          </div>
        </div>
      </section>

      {/* SEASON ARC — the showpiece */}
      <section className="relative z-10 mt-10 px-8 pb-6 md:px-14">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold">
            <span className="opacity-80">Season</span>{" "}
            <span className="opacity-60" style={{ color: academy.logoColor }}>{season}</span>
          </h2>
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            <LegendDot color="#a3b3ff" label="Prep" />
            <LegendDot color="#67e8f9" label="Test" />
            <LegendDot color={academy.logoColor} label="Consolidamento" />
            <LegendDot color="#facc15" label="Mantenimento" />
          </div>
        </div>
        <div className="mt-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5 backdrop-blur-sm">
          <SeasonArc entries={entries.map((e) => ({
            id: e.id,
            monthIdx: e.monthIdx + (e.weekStart.getUTCDate() - 1) / 31,
            columnKey: e.columnKey,
            label: e.tournamentName ?? e.freeText ?? "—",
            location: e.location,
            status: e.status,
          }))} phaseBands={phaseBands} accentHex={academy.logoColor} />
        </div>
      </section>

      {/* UPCOMING + STATS strip */}
      <section className="relative z-10 grid gap-6 px-8 pb-16 md:px-14 lg:grid-cols-12">
        {/* Upcoming tournaments — oversized cards */}
        <div className="space-y-4 lg:col-span-7">
          <div className="kicker">Next on the calendar</div>
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
              No upcoming tournament — pure training block.
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((u) => {
                const days = Math.max(0, Math.round((u.weekStart.getTime() - Date.now()) / 86400_000));
                return (
                  <div
                    key={u.id}
                    className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5 backdrop-blur-sm transition-all hover:border-[var(--color-accent)] hover:shadow-[0_0_60px_rgba(124,255,107,0.08)]"
                  >
                    <div
                      className="pointer-events-none absolute inset-y-0 right-0 w-32 opacity-30"
                      style={{ background: `linear-gradient(90deg, transparent, ${academy.logoColor}40)` }}
                    />
                    <div className="relative flex items-center justify-between gap-6">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{u.columnKey}{u.location ? ` · ${u.location}` : ""}</div>
                        <div className="mt-1 text-2xl font-semibold leading-tight md:text-3xl">{u.tournamentName ?? u.freeText}</div>
                        {u.trainingPhase && (
                          <div className="mt-1 text-[11px] text-[var(--color-muted)]">{u.trainingPhase}</div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="num text-3xl font-bold leading-none md:text-4xl" style={{ color: academy.logoColor }}>
                          {days}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">days away</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats vertical strip */}
        <div className="space-y-3 lg:col-span-5">
          <div className="kicker">Season at a glance</div>
          <div className="grid grid-cols-2 gap-3">
            <StatCell label="Tournament tiers" value={String(Object.keys(totals.byCategory).length)} accent={academy.logoColor} />
            <StatCell label="Planned events" value={String(totals.totalEntries)} accent={academy.logoColor} />
            <StatCell label="Elite track" value={String(totals.eliteCount)} sub="ITF + OPEN" accent={academy.logoColor} />
            <StatCell label="Coming up" value={String(totals.upcomingCount)} sub="next 3 events" accent={academy.logoColor} />
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 backdrop-blur-sm">
            <div className="kicker mb-2">By category</div>
            <ul className="space-y-1.5 text-sm">
              {Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <li key={k} className="flex items-center justify-between">
                  <span className="text-[var(--color-fg)]/85">{k}</span>
                  <span className="num text-xs text-[var(--color-muted)]">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Full month-by-month schedule — readable like Max's Excel */}
      <section className="relative z-10 px-8 pb-24 md:px-14">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="kicker mb-1">Calendario completo</div>
            <h2 className="text-xl font-semibold">
              <span className="opacity-80">12 mesi ·</span>{" "}
              <span className="opacity-60" style={{ color: academy.logoColor }}>settimana per settimana</span>
            </h2>
          </div>
          <p className="max-w-md text-xs text-[var(--color-muted)]">
            Tutto il piano di {athlete.firstName}, organizzato come il foglio Excel di Max. Le settimane vuote sono pure di allenamento.
          </p>
        </div>
        <SeasonSchedule
          season={season}
          accent={academy.logoColor}
          entries={entries.map((e) => ({
            id: e.id,
            weekStart: e.weekStart,
            monthIdx: e.monthIdx,
            trainingPhase: e.trainingPhase,
            columnKey: e.columnKey,
            tournamentName: e.tournamentName,
            freeText: e.freeText,
            location: e.location,
            status: e.status,
          }))}
        />
      </section>

      {/* AI Co-pilot persistent leaf */}
      <AiCopilotLeaf
        athleteName={athlete.firstName}
        accent={academy.logoColor}
        insights={buildInsights(canvas)}
      />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function StatCell({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 backdrop-blur-sm">
      <div className="kicker">{label}</div>
      <div className="num mt-1 text-2xl font-bold" style={{ color: accent }}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

// Coach-language micro-insights — deterministic.
function buildInsights(c: import("@/lib/tennisCanvas").AthleteCanvas): string[] {
  const out: string[] = [];
  if (c.upcoming[0]) {
    const days = Math.round((c.upcoming[0].weekStart.getTime() - Date.now()) / 86400_000);
    out.push(`${days > 0 ? `${days} giorni a` : "Imminente:"} ${c.upcoming[0].tournamentName ?? c.upcoming[0].freeText}. Fase di allenamento attiva: ${c.upcoming[0].trainingPhase ?? "—"}.`);
  }
  const topCat = Object.entries(c.totals.byCategory).sort((a, b) => b[1] - a[1])[0];
  if (topCat) out.push(`Categoria dominante: ${topCat[0]} con ${topCat[1]} eventi pianificati nella stagione.`);
  if (c.totals.eliteCount > 0) out.push(`Track elite confermato — ${c.totals.eliteCount} eventi ITF/OPEN nel piano.`);
  const topPhase = Object.entries(c.totals.byPhase).sort((a, b) => b[1] - a[1])[0];
  if (topPhase) out.push(`Settimane più presenti: ${topPhase[0]} (${topPhase[1]}). Periodizzazione coerente.`);
  return out;
}

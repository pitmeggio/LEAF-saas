import Link from "next/link";
import { requireAcademyId } from "@/lib/auth";
import { getSeasonView } from "@/lib/seasonView";
import { SeasonLanes } from "@/components/SeasonLanes";
import { AiCopilotLeaf } from "@/components/AiCopilotLeaf";

export const dynamic = "force-dynamic";

// Cross-athlete Season View — the killer that Max's Excel doesn't have.
// Same 12-month timeline, one swim-lane per athlete, weekend-clash detection
// drawn as red columns behind the lanes, weekly-load sparkline along the top.
//
// This is the page that makes a head coach say "I need this — Excel can't
// do this for me".
export default async function SeasonViewPage() {
  const academyId = await requireAcademyId();
  const view = await getSeasonView(academyId);
  if (!view) return null;

  const { lanes, clashes, weekLoad, academy, season, narrative } = view;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06070a]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-32 left-1/3 h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
          style={{ background: `radial-gradient(circle at 60% 40%, ${academy.logoColor}35, transparent 60%)` }}
        />
        <div className="absolute inset-0 grid-bg opacity-20" />
      </div>

      <div className="relative z-10 px-8 pb-3 pt-6 md:px-14">
        <Link href="/dashboard/canvas" className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)] hover:text-[var(--color-fg)]">
          ← Canvas index
        </Link>
        <div className="kicker mt-3 text-[10px]" style={{ color: academy.logoColor }}>
          Season View · {academy.name} · {season}
        </div>
        <h1 className="mt-2 font-semibold leading-none tracking-[-0.03em]" style={{ fontSize: "clamp(2rem, 4.2vw, 3.4rem)" }}>
          Tutti gli atleti
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--color-fg)]/75">
          {narrative}
        </p>
      </div>

      <section className="relative z-10 px-8 pb-6 md:px-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Tutti gli atleti · una sola timeline
          </h2>
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            <LegendDot color="#7cff6b" label="ITF / OPEN / ETA" />
            <LegendDot color="#38bdf8" label="Rodeo" />
            <LegendDot color="#a78bfa" label="Categoria" />
            <LegendDot color="#facc15" label="Squadre" />
            <LegendDot color="#fb7185" label="Conflitto weekend" />
          </div>
        </div>
        <div className="mt-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5 backdrop-blur-sm">
          <SeasonLanes
            lanes={lanes.map((l) => ({
              athleteId: l.athleteId,
              displayName: l.displayName,
              age: l.age,
              total: l.total,
              byCategory: l.byCategory,
              topCategory: l.topCategory,
              entries: l.entries.map((e) => ({
                id: e.id,
                monthIdx: e.monthIdx,
                weekStart: e.weekStart.toISOString(),
                columnKey: e.columnKey,
                label: e.label,
                location: e.location,
                status: e.status,
                trainingPhase: e.trainingPhase,
              })),
            }))}
            clashes={clashes.map((c) => ({
              monthIdx: c.monthIdx,
              weekStart: c.weekStart.toISOString(),
              count: c.count,
              athleteNames: c.athleteNames,
            }))}
            weekLoad={weekLoad}
            accentHex={academy.logoColor}
          />
        </div>
      </section>

      {/* Clash detail strip — Max's "calendar problems" inbox */}
      <section className="relative z-10 grid gap-4 px-8 pb-16 md:grid-cols-2 md:px-14 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <div className="kicker mb-2">Weekend con conflitto · {clashes.length}</div>
        </div>
        {clashes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)] lg:col-span-3">
            Nessun conflitto di trasferta nella stagione. Calendario equilibrato.
          </div>
        ) : (
          clashes.slice(0, 9).map((c, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 backdrop-blur-sm"
              style={{ borderLeft: c.count >= 4 ? "3px solid #fb7185" : "3px solid #fbbf24" }}
            >
              <div className="kicker text-[#fb7185]">
                {c.count} atleti · stesso weekend
              </div>
              <div className="mt-1 text-base font-semibold">
                {c.weekStart.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.athleteNames.slice(0, 6).map((n) => (
                  <span key={n} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 px-2 py-0.5 text-[10px] font-medium">
                    {n}
                  </span>
                ))}
                {c.athleteNames.length > 6 && (
                  <span className="text-[10px] text-[var(--color-muted)]">+{c.athleteNames.length - 6}</span>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      <AiCopilotLeaf
        athleteName="la stagione"
        accent={academy.logoColor}
        insights={buildSeasonInsights(view)}
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

function buildSeasonInsights(v: Awaited<ReturnType<typeof getSeasonView>>): string[] {
  if (!v) return [];
  const out: string[] = [];
  const total = v.lanes.reduce((s, l) => s + l.total, 0);
  out.push(`${v.lanes.length} atleti · ${total} eventi pianificati nella stagione ${v.season}.`);
  const heaviest = [...v.lanes].sort((a, b) => b.total - a.total)[0];
  if (heaviest) out.push(`Atleta più carico: ${heaviest.displayName} (${heaviest.total} eventi). Categoria dominante: ${heaviest.topCategory ?? "—"}.`);
  if (v.clashes.length > 0) {
    const top = v.clashes[0];
    out.push(`${v.clashes.length} weekend di conflitto. Il più critico: ${top.weekStart.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} con ${top.count} atleti in trasferta — pianifica lo staff coach.`);
  } else {
    out.push("Nessun conflitto di trasferta. Lo staff coach non si deve dividere.");
  }
  const peakWeek = [...v.weekLoad].sort((a, b) => b.total - a.total)[0];
  if (peakWeek) out.push(`Picco di carico: settimana ${peakWeek.weekIso.split("-W")[1]} con ${peakWeek.total} eventi.`);
  return out;
}

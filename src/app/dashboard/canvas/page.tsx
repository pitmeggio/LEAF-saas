import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import { AddTennisAthleteButton } from "@/components/AddTennisAthleteButton";
import { SearchFilter } from "@/components/SearchFilter";

export const dynamic = "force-dynamic";

// Canvas index — entry point that lets the head coach pick which athlete
// to open in cinematic mode. We render one big tile per athlete with their
// season-plan signature (how many ITF / OPEN / category entries they have)
// so Max can pick at a glance.
export default async function CanvasIndex() {
  const academyId = await requireAcademyId();
  const academy = await prisma.academy.findUnique({
    where: { id: academyId },
    select: { name: true, logoColor: true, sport: true },
  });

  const plans = await prisma.tennisSeasonPlan.findMany({
    where: { academyId },
    include: {
      athlete: { select: { id: true, firstName: true, lastName: true, gender: true, dob: true } },
      entries: { select: { columnKey: true, status: true } },
    },
    orderBy: { season: "desc" },
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06070a]">
      {/* Ambient depth */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute right-[-180px] top-[-120px] h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
          style={{ background: `radial-gradient(circle at 60% 40%, ${academy?.logoColor ?? "#7CFF6B"}35, transparent 60%)` }}
        />
        <div className="absolute inset-0 grid-bg opacity-20" />
      </div>

      <header className="relative z-10 flex flex-wrap items-start justify-between gap-4 px-8 pb-3 pt-6 md:px-14">
        <div>
          <div className="kicker text-[10px]" style={{ color: academy?.logoColor ?? "#7CFF6B" }}>
            Rosa · {academy?.name ?? "Roster"}
          </div>
          <h1 className="mt-3 font-semibold leading-none tracking-[-0.03em]" style={{ fontSize: "clamp(2rem, 4.2vw, 3.4rem)" }}>
            Rosa {plans[0]?.season ?? ""}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--color-fg)]/75">
            Apri un atleta — entra nella sua stagione come una storia, non una tabella.
          </p>
        </div>
        <AddTennisAthleteButton accent={academy?.logoColor ?? "#a78bfa"} />
      </header>

      {plans.length > 0 && (
        <div className="relative z-10 px-8 pb-4 md:px-14">
          <SearchFilter targetId="anagrafica-atleti" placeholder="Cerca atleta per nome…" className="max-w-sm" />
        </div>
      )}

      <section id="anagrafica-atleti" className="relative z-10 grid gap-5 px-8 pb-16 md:grid-cols-2 md:px-14 lg:grid-cols-3">
        <div id="anagrafica-atleti-empty" style={{ display: "none" }} className="rounded-3xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)] md:col-span-2 lg:col-span-3">
          Nessun atleta trovato.
        </div>
        {plans.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted)] md:col-span-2 lg:col-span-3">
            Nessun piano stagionale ancora. Importa il tuo file CALENDARI TORNEI per popolare il canvas dei tuoi atleti.
          </div>
        )}
        {plans.map((p) => {
          const counts: Record<string, number> = {};
          for (const e of p.entries) counts[e.columnKey] = (counts[e.columnKey] ?? 0) + 1;
          const total = p.entries.length;
          const age = Math.floor((Date.now() - p.athlete.dob.getTime()) / (365.25 * 86400_000));
          return (
            <Link
              key={p.id}
              href={`/dashboard/canvas/${p.athleteId}`}
              data-name={`${p.athlete.firstName} ${p.athlete.lastName}`.toLowerCase()}
              className="group relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-6 backdrop-blur-sm transition-all hover:border-[var(--color-accent)] hover:shadow-[0_30px_80px_rgba(124,255,107,0.10)]"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `radial-gradient(circle at 70% 0%, ${academy?.logoColor ?? "#7CFF6B"}22, transparent 60%)` }}
              />
              <div className="relative">
                <div className="kicker">Stagione {p.season}</div>
                <div className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-3xl">
                  {p.athlete.firstName}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                  {p.athlete.gender ?? "—"} · {age} anni · {total} eventi
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => (
                    <span
                      key={k}
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 px-2 py-0.5 text-[10px] font-medium"
                    >
                      {k} · {n}
                    </span>
                  ))}
                </div>
                <div className="mt-5 text-[10px] uppercase tracking-wider text-[var(--color-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                  apri scheda →
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

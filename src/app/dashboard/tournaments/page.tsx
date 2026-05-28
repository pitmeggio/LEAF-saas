import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import { TournamentImportButton } from "@/components/TournamentImportButton";

export const dynamic = "force-dynamic";

// LEAF OS Professional Tennis — tournament catalogue.
//
// The academy-wide list of tournaments the head coach tracks. Imported in
// bulk from Max's CALENDARI TORNEI.xlsx, or added one at a time. Shows
// upcoming first, then past, with category badge + ranking-points hint.
export default async function TournamentsPage() {
  const academyId = await requireAcademyId();
  const academy = await prisma.academy.findUnique({
    where: { id: academyId },
    select: { name: true, logoColor: true, sport: true },
  });
  const accent = academy?.logoColor ?? "#a78bfa";

  const tournaments = await prisma.tennisTournament.findMany({
    where: { academyId },
    orderBy: { startDate: "asc" },
    take: 500,
  });

  const now = new Date();
  const upcoming = tournaments.filter((t) => t.startDate >= now);
  const past = tournaments.filter((t) => t.startDate < now);

  const byCategory: Record<string, number> = {};
  for (const t of tournaments) byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;

  return (
    <>
      <PageHeader
        title="Tornei"
        subtitle={`${tournaments.length} eventi nel catalogo · ${upcoming.length} in arrivo · ${Object.keys(byCategory).length} categorie`}
        right={<TournamentImportButton />}
      />
      <div className="space-y-6 p-8">
        {/* Category strip */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => (
              <span
                key={k}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium"
                style={{ borderLeft: `3px solid ${CATEGORY_COLOR[k] ?? accent}` }}
              >
                {k}
                <span className="ml-2 text-[var(--color-muted)]">{n}</span>
              </span>
            ))}
        </div>

        {/* Upcoming */}
        <section>
          <div className="kicker mb-3">In arrivo · {upcoming.length}</div>
          {upcoming.length === 0 ? (
            <div className="card flex items-center justify-center p-12 text-sm text-[var(--color-muted)]">
              Nessun torneo programmato. Importa il file calendario per popolare il catalogo.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {upcoming.slice(0, 30).map((t) => (
                <TournamentCard key={t.id} t={t} accent={accent} highlight />
              ))}
            </div>
          )}
        </section>

        {/* Past (limited) */}
        {past.length > 0 && (
          <section>
            <div className="kicker mb-3">Già giocati · {past.length}</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {past.slice(-12).reverse().map((t) => (
                <TournamentCard key={t.id} t={t} accent={accent} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

const CATEGORY_COLOR: Record<string, string> = {
  ITF: "#7cff6b", OPEN: "#7cff6b", ETA: "#7cff6b",
  RODEO_OPEN: "#38bdf8", RODEO: "#38bdf8",
  CAT_2: "#a78bfa", CAT_2_3: "#a78bfa", CAT_3: "#a78bfa", CAT_3_4: "#a78bfa", CAT_4: "#a78bfa",
  YOUTH: "#fb7185", U12_14: "#fb7185",
  TEAM: "#facc15", TEAM_D1: "#facc15",
  ALT: "#94a3b8",
};

function TournamentCard({
  t,
  accent,
  highlight,
}: {
  t: { id: string; name: string; category: string; location: string | null; startDate: Date; endDate: Date; ageGroup: string | null; surface: string | null; pointsPotential: number | null };
  accent: string;
  highlight?: boolean;
}) {
  const days = Math.round((t.startDate.getTime() - Date.now()) / 86400_000);
  const color = CATEGORY_COLOR[t.category] ?? accent;
  const fmt = (d: Date) => d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
  return (
    <div
      className="card relative overflow-hidden p-4"
      style={highlight ? { borderLeft: `3px solid ${color}` } : undefined}
    >
      <div className="kicker" style={{ color }}>{t.category}{t.surface ? ` · ${t.surface}` : ""}</div>
      <div className="mt-1 text-base font-semibold leading-tight">{t.name}</div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
        <span>{fmt(t.startDate)} – {fmt(t.endDate)}</span>
        {t.location && <span>· {t.location}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {t.ageGroup && (
            <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
              {t.ageGroup}
            </span>
          )}
          {t.pointsPotential && (
            <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
              {t.pointsPotential} pts
            </span>
          )}
        </div>
        {highlight && days >= 0 && (
          <div className="text-right">
            <div className="num text-lg font-bold leading-none" style={{ color }}>{days}</div>
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-muted)]">giorni</div>
          </div>
        )}
      </div>
    </div>
  );
}

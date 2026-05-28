import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import { CreateCampButton } from "@/components/CreateCampButton";

export const dynamic = "force-dynamic";

// LEAF OS Essential Tennis — Camps & Groups.
//
// Tennis analogue of Pay-and-Train (ski). Where a ski Pay-and-Train slot is
// a single 2-hour booking, a tennis camp is a multi-day group sign-up. Public
// registration flow is `/academy/[slug]/camps` (to be built next iteration);
// for tonight the admin can create/edit camps + see registrations come in.
export default async function CampsPage() {
  const academyId = await requireAcademyId();
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { name: true, logoColor: true, currency: true, slug: true } });
  const currency = academy?.currency ?? "EUR";

  const camps = await prisma.tennisCamp.findMany({
    where: { academyId },
    include: { registrations: { select: { id: true, status: true } } },
    orderBy: { startDate: "asc" },
  });

  const upcoming = camps.filter((c) => c.endDate >= new Date());
  const past = camps.filter((c) => c.endDate < new Date());

  const fmt = (d: Date) => d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <>
      <PageHeader
        title="Camp & Gruppi estivi"
        subtitle={`${camps.length} ${camps.length === 1 ? "camp" : "camp"} pianificati · ${upcoming.length} in arrivo`}
        right={<CreateCampButton />}
      />
      <div className="space-y-6 p-8">
        {camps.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <div className="text-2xl">🎾</div>
            <h2 className="text-base font-semibold">Nessun camp ancora</h2>
            <p className="max-w-md text-sm text-[var(--color-muted)]">
              Apri il primo camp del club — i genitori si iscrivono dal sito pubblico, le iscrizioni arrivano qui in tempo reale e il livello dichiarato del bambino alimenta un mini-profilo già pronto.
            </p>
          </div>
        ) : (
          <>
            <section>
              <div className="kicker mb-3">In arrivo · {upcoming.length}</div>
              <div className="grid gap-3 md:grid-cols-2">
                {upcoming.map((c) => {
                  const confirmed = c.registrations.filter((r) => r.status !== "cancelled").length;
                  const full = confirmed >= c.capacity;
                  return (
                    <div key={c.id} className="card relative overflow-hidden p-5" style={{ borderLeft: `3px solid ${academy?.logoColor ?? "#a78bfa"}` }}>
                      <div className="kicker">{c.level ?? "Camp"}{c.ageMin || c.ageMax ? ` · ${c.ageMin ?? "?"}-${c.ageMax ?? "?"}y` : ""}</div>
                      <div className="mt-1 text-lg font-semibold">{c.name}</div>
                      <div className="mt-1 text-xs text-[var(--color-muted)]">{fmt(c.startDate)} → {fmt(c.endDate)}</div>
                      {c.description && <p className="mt-2 line-clamp-2 text-xs text-[var(--color-fg)]/75">{c.description}</p>}
                      <div className="mt-4 flex items-center justify-between">
                        <div>
                          <div className="num text-xl font-bold" style={{ color: academy?.logoColor ?? "#a78bfa" }}>
                            {confirmed}<span className="text-sm text-[var(--color-muted)]">/{c.capacity}</span>
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                            {full ? "esaurito" : "iscritti"}
                          </div>
                        </div>
                        <div className="num text-sm font-semibold">
                          {currency} {c.price.toLocaleString("en-US")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            {past.length > 0 && (
              <section>
                <div className="kicker mb-3">Conclusi · {past.length}</div>
                <div className="grid gap-3 md:grid-cols-3">
                  {past.slice(-6).map((c) => (
                    <div key={c.id} className="card p-4 opacity-60">
                      <div className="text-sm font-semibold">{c.name}</div>
                      <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{fmt(c.startDate)} → {fmt(c.endDate)}</div>
                      <div className="mt-2 text-xs">{c.registrations.length} iscritti totali</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

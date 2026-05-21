import Link from "next/link";
import { getPublicAcademiesDirectory, getPublicAthletesDirectory } from "@/lib/profiles";
import { PublicNav } from "@/components/PublicNav";
import { RecruitingBadge } from "@/components/Recruiting";
import { DISCIPLINE_LABEL, COUNTRY } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explore — Leaf" };

export default async function ExplorePage() {
  const [academies, athletes] = await Promise.all([getPublicAcademiesDirectory(), getPublicAthletesDirectory()]);

  return (
    <div className="min-h-screen">
      <PublicNav active="explore" />

      <div className="mx-auto max-w-5xl px-5 py-12 md:px-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Explore Leaf</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
            High-performance academies and verified athlete profiles — all connected. Browse academies, open their athletes, and dive into performance analytics.
          </p>
        </div>

        {/* Academies */}
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Academies</h2>
            <span className="text-xs text-[var(--color-muted)]">{academies.length}</span>
          </div>
          {academies.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No academies yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {academies.map((a) => (
                <Link key={a.slug} href={`/academy/${a.slug}`} className="card group p-5 transition-colors hover:border-[var(--color-accent)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black" style={{ background: a.logoColor, color: "#0a0c10" }}>{a.name[0]}</div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{a.name}</div>
                      <div className="truncate text-xs text-[var(--color-muted)]">{a.location ?? ""}{a.location ? " · " : ""}<span className="capitalize">{a.sport}</span></div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {a.recruiting ? <RecruitingBadge status={a.recruiting} size="sm" /> : <span className="text-xs text-[var(--color-muted)]">Not recruiting</span>}
                    <span className="text-xs text-[var(--color-muted)]">{a.athleteCount} athlete{a.athleteCount === 1 ? "" : "s"}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Athletes */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Athletes</h2>
            <span className="text-xs text-[var(--color-muted)]">{athletes.length}</span>
          </div>
          {athletes.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No public athlete profiles yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {athletes.map((a) => {
                const country = COUNTRY[a.nationality];
                const initials = `${a.firstName[0] ?? ""}${a.lastName[0] ?? ""}`.toUpperCase();
                return (
                  <Link key={a.slug} href={`/athlete/${a.slug}`} className="card group flex items-center gap-4 p-5 transition-colors hover:border-[var(--color-accent)]">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                      {a.publicPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.publicPhotoUrl} alt={`${a.firstName} ${a.lastName}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-black" style={{ background: a.photoColor, color: "#fff" }}>{initials}</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">{a.firstName} {a.lastName}</span>
                        {a.verified && <span title="Verified" style={{ color: "#7cff6b" }}>✓</span>}
                      </div>
                      <div className="truncate text-xs text-[var(--color-muted)]">
                        {country?.flag} {DISCIPLINE_LABEL[a.discipline] ?? a.discipline}{a.academyName ? ` · ${a.academyName}` : ""}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <footer className="border-t border-[var(--color-border)] px-5 py-6 text-center text-xs text-[var(--color-muted)] md:px-12">
        Leaf · Academy OS + Athlete Profiles
      </footer>
    </div>
  );
}

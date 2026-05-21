import Link from "next/link";
import { notFound } from "next/navigation";
import { getAcademyPublicAthletes } from "@/lib/profiles";
import { PublicNav } from "@/components/PublicNav";
import { SiteFooter } from "@/components/SiteFooter";
import { DISCIPLINE_LABEL, COUNTRY, fmtPoints } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function AcademyProfilesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getAcademyPublicAthletes(slug);
  if (!data) notFound();
  const { academy, athletes } = data;

  return (
    <div className="min-h-screen">
      <PublicNav />
      <header className="sticky top-[57px] z-20 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-5 py-3 backdrop-blur md:top-[61px] md:px-12">
        <Link href={`/academy/${academy.slug}`} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg font-black" style={{ background: academy.logoColor, color: "#0a0c10" }}>{academy.name[0]}</div>
          <span className="font-semibold">{academy.name}</span>
        </Link>
        <Link href={`/academy/${academy.slug}`} className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">← Academy</Link>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-12 md:px-12">
        <div className="mb-8">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>Athletes</div>
          <h1 className="display mt-1 text-3xl font-bold tracking-tight md:text-4xl">Public athlete profiles</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Verified athletes training at {academy.name}.</p>
        </div>

        {athletes.length === 0 ? (
          <div className="card p-10 text-center text-sm text-[var(--color-muted)]">No public athlete profiles yet.</div>
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
                      {country?.flag} {DISCIPLINE_LABEL[a.discipline] ?? a.discipline}
                      {a.fisPoints != null && <> · {fmtPoints(a.fisPoints)} FIS</>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicAcademy } from "@/lib/queries";
import { RecruitingBadge } from "@/components/Recruiting";
import { PublicNav } from "@/components/PublicNav";
import type { RecruitingStatus } from "@/lib/profiles";
import { DISCIPLINE_LABEL, COUNTRY } from "@/lib/domain";

export const dynamic = "force-dynamic";

const PERIOD_LABEL: Record<string, string> = { season: "/ season", camp: "/ camp", month: "/ month" };

export default async function PublicAcademyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academy = await getPublicAcademy(slug);
  if (!academy) notFound();

  const country = COUNTRY[academy.country];
  const requirements = (academy.requirements ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const applyHref = `/academy/${academy.slug}/apply`;
  const profilesHref = `/academy/${academy.slug}/profiles`;
  const recruitingOpen = academy.recruitingEnabled && academy.recruitingStatus !== "CLOSED";

  return (
    <div className="min-h-screen">
      <PublicNav />
      {/* Academy context bar */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5 md:px-12">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg font-black"
            style={{ background: academy.logoColor, color: "#0a0c10" }}
          >
            {academy.name[0]}
          </div>
          <span className="font-semibold">{academy.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={profilesHref} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)]">
            Athletes
          </Link>
          <Link
            href={applyHref}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]"
          >
            Apply now
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-5 py-16 text-center md:px-12 md:py-24">
        <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-xs">
          {recruitingOpen && <RecruitingBadge status={academy.recruitingStatus as RecruitingStatus} size="sm" />}
          <Badge>{country?.flag} {academy.location ?? country?.name}</Badge>
          <Badge>Alpine skiing</Badge>
          {academy.season && <Badge>Season {academy.season}</Badge>}
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          {academy.tagline ?? academy.name}
        </h1>
        {academy.description && (
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
            {academy.description}
          </p>
        )}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={applyHref}
            className="w-full rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] sm:w-auto"
          >
            Apply now →
          </Link>
          <Link
            href={profilesHref}
            className="w-full rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-medium hover:bg-[var(--color-surface)] sm:w-auto"
          >
            View athletes
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-5 pb-24 md:px-12">
        {/* Programs */}
        <section id="programs">
          <SectionTitle kicker="Training" title="Programs" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {academy.programs.map((p) => (
              <div key={p.id} className="card p-5">
                <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{DISCIPLINE_LABEL[p.discipline]}</div>
                <div className="mt-1 text-base font-semibold">{p.name}</div>
                <div className="mt-2 text-sm text-[var(--color-muted)]">
                  Age {p.ageMin}–{p.ageMax} · Season {p.season}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Packages */}
        {academy.packages.length > 0 && (
          <section id="packages">
            <SectionTitle kicker="Pricing" title="Packages & subscriptions" />
            <div className="grid gap-4 md:grid-cols-3">
              {academy.packages.map((pkg, i) => {
                const features = (pkg.features ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
                const featured = i === 0;
                return (
                  <div
                    key={pkg.id}
                    className="card flex flex-col p-6"
                    style={featured ? { borderColor: "var(--color-accent)" } : undefined}
                  >
                    {featured && (
                      <div className="mb-3 inline-flex w-fit rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "#7cff6b1a", color: "#7cff6b" }}>
                        Most popular
                      </div>
                    )}
                    <div className="text-base font-semibold">{pkg.name}</div>
                    {pkg.price != null && (
                      <div className="mt-2 flex items-end gap-1">
                        <span className="num text-3xl font-bold">€{pkg.price.toLocaleString("en-US")}</span>
                        <span className="mb-1 text-xs text-[var(--color-muted)]">{PERIOD_LABEL[pkg.period] ?? ""}</span>
                      </div>
                    )}
                    {pkg.description && <p className="mt-3 text-sm text-[var(--color-muted)]">{pkg.description}</p>}
                    <ul className="mt-4 space-y-2 text-sm">
                      {features.map((f) => (
                        <li key={f} className="flex gap-2">
                          <span style={{ color: "var(--color-accent)" }}>✓</span>
                          <span className="text-[var(--color-fg)]/90">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`${applyHref}?package=${pkg.id}`}
                      className={`mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                        featured
                          ? "bg-[var(--color-accent)] text-[#0a0c10] hover:bg-[var(--color-accent-dim)]"
                          : "border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
                      }`}
                    >
                      Apply with this package
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Requirements */}
        {requirements.length > 0 && (
          <section>
            <SectionTitle kicker="Eligibility" title="Requirements" />
            <div className="card p-6">
              <ul className="grid gap-3 sm:grid-cols-2">
                {requirements.map((r) => (
                  <li key={r} className="flex gap-2.5 text-sm">
                    <span style={{ color: "var(--color-accent)" }}>›</span>
                    <span className="text-[var(--color-fg)]/90">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Final CTA */}
        <section className="card flex flex-col items-center gap-4 p-10 text-center">
          <h2 className="text-2xl font-bold">Ready to apply?</h2>
          <p className="max-w-md text-sm text-[var(--color-muted)]">
            Apply with your FIS code and your verified sports CV — results, ranking and growth trend — builds itself.
          </p>
          <Link
            href={applyHref}
            className="rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]"
          >
            Start application →
          </Link>
        </section>
      </div>

      <footer className="border-t border-[var(--color-border)] px-5 py-6 text-center text-xs text-[var(--color-muted)] md:px-12">
        Powered by LEAF
      </footer>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[var(--color-muted)]">
      {children}
    </span>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-6">
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>{kicker}</div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

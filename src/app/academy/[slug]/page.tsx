import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicAcademy } from "@/lib/queries";
import { RecruitingBadge } from "@/components/Recruiting";
import { PublicNav } from "@/components/PublicNav";
import { SiteFooter } from "@/components/SiteFooter";
import type { RecruitingStatus } from "@/lib/profiles";
import { DISCIPLINE_LABEL, COUNTRY } from "@/lib/domain";

export const dynamic = "force-dynamic";

const PERIOD_LABEL: Record<string, string> = { season: "/ season", camp: "/ camp", month: "/ month" };
const COACH_ROLE: Record<string, string> = { head_coach: "Head coach", coach: "Coach", physio: "Physiotherapist", s_and_c: "Strength & conditioning" };

export default async function PublicAcademyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academy = await getPublicAcademy(slug);
  if (!academy) notFound();

  const country = COUNTRY[academy.country];
  const requirements = (academy.requirements ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const applyHref = `/academy/${academy.slug}/apply`;
  const profilesHref = `/academy/${academy.slug}/profiles`;
  const recruitingOpen = academy.recruitingEnabled && academy.recruitingStatus !== "CLOSED";
  const athleteCount = academy._count.enrollments;

  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* Academy context bar */}
      <header className="sticky top-[57px] z-20 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-5 py-3 backdrop-blur md:top-[61px] md:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg font-black" style={{ background: academy.logoColor, color: "#0a0c10" }}>
            {academy.name[0]}
          </div>
          <span className="font-semibold">{academy.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={profilesHref} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)]">
            Athletes
          </Link>
          <Link href={applyHref} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
            Apply now
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-[8%] top-[-120px] h-[320px] w-[520px] glow-accent" />
        <div className="relative mx-auto max-w-5xl px-5 py-16 md:px-12 md:py-20">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {recruitingOpen && <RecruitingBadge status={academy.recruitingStatus as RecruitingStatus} size="sm" />}
            <Badge>{country?.flag} {academy.location ?? country?.name}</Badge>
            <Badge className="capitalize">{academy.sport === "ski" ? "Alpine skiing" : academy.sport}</Badge>
            {academy.season && <Badge>Season {academy.season}</Badge>}
          </div>

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-3xl font-black ring-1 ring-[var(--color-border)]" style={{ background: academy.logoColor, color: "#0a0c10" }}>
              {academy.name[0]}
            </div>
            <div className="flex-1">
              <div className="kicker mb-1.5" style={{ color: "var(--color-accent)" }}>Performance academy</div>
              <h1 className="display max-w-3xl text-4xl font-bold leading-[1.05] md:text-5xl">
                {academy.tagline ?? academy.name}
              </h1>
              {academy.tagline && <div className="mt-2 text-base font-medium text-[var(--color-muted)]">{academy.name}</div>}
              {academy.description && (
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-fg)]/85">{academy.description}</p>
              )}
            </div>
          </div>

          {/* Stat strip */}
          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat label="Verified athletes" value={String(athleteCount)} accent />
            <HeroStat label="Programs" value={String(academy._count.programs)} />
            <HeroStat label="Coaching staff" value={String(academy.coaches.length)} />
            <HeroStat label="Packages" value={String(academy.packages.length)} />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={applyHref} className="rounded-xl bg-[var(--color-accent)] px-6 py-3 text-center text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
              Apply now →
            </Link>
            <Link href={profilesHref} className="rounded-xl border border-[var(--color-border)] px-6 py-3 text-center text-sm font-semibold hover:border-[var(--color-accent)]">
              View athletes
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-5 py-16 md:px-12">
        {/* Programs */}
        {academy.programs.length > 0 && (
          <section id="programs">
            <SectionTitle kicker="Training" title="Programs" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {academy.programs.map((p) => (
                <div key={p.id} className="card group p-5 transition-colors hover:border-[var(--color-accent)]">
                  <div className="kicker">{DISCIPLINE_LABEL[p.discipline] ?? p.discipline}</div>
                  <div className="mt-1.5 text-base font-semibold">{p.name}</div>
                  <div className="mt-2 text-sm text-[var(--color-muted)]">Age {p.ageMin}–{p.ageMax} · Season {p.season}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Coaching staff */}
        {academy.coaches.length > 0 && (
          <section id="staff">
            <SectionTitle kicker="The team" title="Coaching staff" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {academy.coaches.map((c) => (
                <div key={c.id} className="card flex items-center gap-3.5 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ring-[var(--color-border)]" style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}>
                    {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="truncate text-xs text-[var(--color-muted)]">
                      {COACH_ROLE[c.role] ?? c.role}{c.specialization ? ` · ${c.specialization}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Packages */}
        {academy.packages.length > 0 && (
          <section id="packages">
            <SectionTitle kicker="Pricing" title="Packages & subscriptions" />
            <div className="grid gap-4 md:grid-cols-3">
              {academy.packages.map((pkg, i) => {
                const features = (pkg.features ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
                const featured = i === 0;
                return (
                  <div key={pkg.id} className="card relative flex flex-col p-6" style={featured ? { borderColor: "var(--color-accent)" } : undefined}>
                    {featured && <span className="absolute inset-x-0 top-0 h-[2px] rounded-t-[14px]" style={{ background: "var(--color-accent)", opacity: 0.85 }} />}
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
        <section className="card relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[220px] w-[400px] -translate-x-1/2 glow-accent" />
          <div className="relative flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold">Ready to apply?</h2>
            <p className="max-w-md text-sm text-[var(--color-muted)]">
              Apply with your FIS code — your verified sports CV (results, ranking and growth trend) builds itself.
            </p>
            <Link href={applyHref} className="rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
              Start application →
            </Link>
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[var(--color-muted)] ${className}`}>
      {children}
    </span>
  );
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card-2 relative p-4">
      {accent && <span className="absolute inset-x-0 top-0 h-[2px] rounded-t-[12px]" style={{ background: "var(--color-accent)", opacity: 0.85 }} />}
      <div className="kicker">{label}</div>
      <div className="num mt-1.5 text-2xl font-bold tracking-tight" style={accent ? { color: "var(--color-accent)" } : undefined}>{value}</div>
    </div>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-6">
      <div className="kicker" style={{ color: "var(--color-accent)" }}>{kicker}</div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

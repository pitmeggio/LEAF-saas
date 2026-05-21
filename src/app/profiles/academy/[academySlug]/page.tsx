import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicRecruitingAcademy } from "@/lib/profiles";
import { RecruitingBadge, ApplyCTA } from "@/components/Recruiting";
import { DISCIPLINE_LABEL, COUNTRY, fmtDate } from "@/lib/domain";

export const dynamic = "force-dynamic";

const COACH_ROLE_LABEL: Record<string, string> = {
  head_coach: "Head Coach", coach: "Coach", physio: "Physio", s_and_c: "S&C Coach",
};

export default async function AcademyRecruitingPage({ params }: { params: Promise<{ academySlug: string }> }) {
  const { academySlug } = await params;
  const a = await getPublicRecruitingAcademy(academySlug);
  if (!a) notFound();

  const closed = a.status === "CLOSED";

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 md:px-12">
        <Link href="/profiles" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg font-black" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>L</div>
          <span className="text-sm font-semibold">Leaf Profiles</span>
        </Link>
        <div className="flex gap-2">
          <Link href={a.viewProgramHref} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)]">View program</Link>
          {a.applyEnabled && !closed && a.applyHref && (
            <ApplyCTA href={a.applyHref} external={a.applyExternal} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">Apply now</ApplyCTA>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-5 pt-12 md:px-12">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-3xl font-black" style={{ background: a.logoColor, color: "#0a0c10" }}>
            {a.name[0]}
          </div>
          <div className="flex-1">
            <div className="mb-2 flex justify-center sm:justify-start"><RecruitingBadge status={a.status} /></div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{a.name}</h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-[var(--color-muted)] sm:justify-start">
              {a.location && <span>{a.location}</span>}
              <span>·</span>
              <span className="capitalize">{a.sport}</span>
              {a.season && <><span>·</span><span>Intake {a.season}</span></>}
            </div>
            {a.headline && <p className="mt-4 text-base font-medium">{a.headline}</p>}
          </div>
        </div>
        {a.description && <p className="mx-auto mt-8 max-w-2xl text-center text-base leading-relaxed text-[var(--color-fg)]/90 sm:text-left">{a.description}</p>}
        {!a.description && a.bio && <p className="mx-auto mt-8 max-w-2xl text-center text-base leading-relaxed text-[var(--color-fg)]/90 sm:text-left">{a.bio}</p>}
      </section>

      <div className="mx-auto max-w-4xl space-y-12 px-5 py-12 md:px-12">
        {/* Key facts */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Fact label="Season intake" value={a.season ?? "—"} />
          <Fact label="Spots available" value={a.availableSpots != null ? String(a.availableSpots) : "—"} accent={a.availableSpots != null} />
          <Fact label="Application deadline" value={a.applicationDeadline ? fmtDate(a.applicationDeadline) : "Rolling"} />
        </section>

        {/* Disciplines */}
        {a.disciplines.length > 0 && (
          <Section kicker="Sport focus" title="Disciplines">
            <div className="flex flex-wrap gap-2">
              {a.disciplines.map((d) => <Chip key={d}>{DISCIPLINE_LABEL[d] ?? d}</Chip>)}
            </div>
          </Section>
        )}

        {/* Program types */}
        {a.programTypes.length > 0 && (
          <Section kicker="Programs" title="Program types">
            <div className="grid gap-3 sm:grid-cols-2">
              {a.programTypes.map((p) => (
                <div key={p} className="card flex items-center gap-3 p-4">
                  <span className="text-[var(--color-accent)]">◆</span>
                  <span className="text-sm font-medium">{p}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Eligibility */}
        {(a.acceptedCountries.length > 0 || a.ageCategories.length > 0 || a.rankingRequirement) && (
          <Section kicker="Eligibility" title="Who we're recruiting">
            <div className="space-y-4">
              {a.ageCategories.length > 0 && (
                <Row label="Age categories"><div className="flex flex-wrap gap-2">{a.ageCategories.map((c) => <Chip key={c}>{c}</Chip>)}</div></Row>
              )}
              {a.acceptedCountries.length > 0 && (
                <Row label="Accepted countries">
                  <div className="flex flex-wrap gap-2">
                    {a.acceptedCountries.map((c) => {
                      const country = COUNTRY[c.toUpperCase()];
                      return <Chip key={c}>{country ? `${country.flag} ${country.name}` : c}</Chip>;
                    })}
                  </div>
                </Row>
              )}
              {a.rankingRequirement && <Row label="Ranking requirement"><span className="text-sm">{a.rankingRequirement}</span></Row>}
            </div>
          </Section>
        )}

        {/* Coaches */}
        {a.coaches.length > 0 && (
          <Section kicker="Team" title="Coaching staff">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {a.coaches.map((c) => (
                <div key={c.id} className="card p-4">
                  <div className="text-sm font-semibold">{c.name}</div>
                  <div className="text-xs text-[var(--color-muted)]">{COACH_ROLE_LABEL[c.role] ?? c.role}{c.specialization ? ` · ${c.specialization}` : ""}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* CTA */}
        <section className="card flex flex-col items-center gap-4 p-10 text-center">
          {closed ? (
            <>
              <h2 className="text-2xl font-bold">Recruiting is currently closed</h2>
              <p className="max-w-md text-sm text-[var(--color-muted)]">{a.name} is not accepting applications right now. Explore the program and check back next intake.</p>
              <Link href={a.viewProgramHref} className="rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold hover:bg-[var(--color-surface-2)]">View program</Link>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold">Apply to {a.name}</h2>
              <p className="max-w-md text-sm text-[var(--color-muted)]">
                {a.status === "WAITLIST_OPEN" ? "Spots are full — join the waitlist to be considered as places open up." : "Submit your verified sports CV — results, ranking and growth trend build themselves."}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {a.applyEnabled && a.applyHref && (
                  <ApplyCTA href={a.applyHref} external={a.applyExternal} className="rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
                    {a.status === "WAITLIST_OPEN" ? "Join waitlist →" : "Start application →"}
                  </ApplyCTA>
                )}
                {a.contactEmail && (
                  <a href={`mailto:${a.contactEmail}?subject=${encodeURIComponent(`Recruiting enquiry — ${a.name}`)}`} className="rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold hover:bg-[var(--color-surface-2)]">
                    Contact academy
                  </a>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <footer className="border-t border-[var(--color-border)] px-5 py-6 text-center text-xs text-[var(--color-muted)] md:px-12">
        Powered by LEAF · Academy recruiting
      </footer>
    </div>
  );
}

function Fact({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
      <div className="num mt-1 text-2xl font-bold" style={accent ? { color: "var(--color-accent)" } : undefined}>{value}</div>
    </div>
  );
}

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-5">
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>{kicker}</div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="w-40 shrink-0 text-sm text-[var(--color-muted)]">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-sm">{children}</span>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { resolvePublicProfile, type PublicProfile } from "@/lib/profiles";
import { AcademyRecruitingBanner } from "@/components/Recruiting";
import { PublicNav } from "@/components/PublicNav";
import { PerformanceAnalytics } from "@/components/PerformanceAnalytics";
import { GrowthChart } from "@/components/GrowthChart";
import { getSession } from "@/lib/auth";
import { DISCIPLINE_LABEL, COUNTRY, fmtPoints, fmtDate } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { athleteSlug } = await params;
  const { new: isNew } = await searchParams;
  // Anonymous-safe: only ACADEMY_ONLY profiles consult the viewer's academy.
  const session = await getSession();
  const res = await resolvePublicProfile(athleteSlug, session?.academyId ?? null);
  if (res.status !== "ok") notFound();
  const p = res.profile;

  const country = COUNTRY[p.nationality];
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* Just-created confirmation */}
      {isNew && (
        <div className="border-b border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10">
          <div className="mx-auto flex max-w-4xl flex-col items-start gap-1 px-5 py-3.5 md:flex-row md:items-center md:justify-between md:px-12">
            <div className="text-sm">
              <span className="font-semibold text-[var(--color-accent)]">✓ Profile created.</span>{" "}
              <span className="text-[var(--color-fg)]/85">This is your verified profile — share this page's link with academies and coaches.</span>
            </div>
            <span className="text-xs text-[var(--color-muted)]">Manage visibility from your academy workspace once enrolled.</span>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-[10%] top-[-100px] h-[300px] w-[460px] glow-accent" />
        <div className="relative mx-auto max-w-4xl px-5 pt-12 pb-10 md:px-12">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl ring-1 ring-[var(--color-border)]">
              {p.publicPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.publicPhotoUrl} alt={`${p.firstName} ${p.lastName}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-black" style={{ background: p.photoColor, color: "#fff" }}>{initials}</div>
              )}
            </div>
            <div className="flex-1">
              <div className="kicker mb-2">Athlete profile</div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                <h1 className="display text-4xl font-bold md:text-5xl">{p.firstName} {p.lastName}</h1>
                {p.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "#7cff6b1a", color: "#7cff6b" }}>
                    ✓ Verified
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-[var(--color-muted)] sm:justify-start">
                <span>{country?.flag} {country?.name ?? p.nationality}</span>
                <span>·</span>
                <span className="capitalize">{p.sport}</span>
                {p.disciplines.length > 0 && <><span>·</span><span>{p.disciplines.map((d) => DISCIPLINE_LABEL[d] ?? d).join(", ")}</span></>}
                {p.academyName && <><span>·</span><span className="text-[var(--color-fg)]">{p.academyName}</span></>}
              </div>
            </div>
          </div>

          {p.publicBio && (
            <p className="mt-7 max-w-2xl text-base leading-relaxed text-[var(--color-fg)]/85">{p.publicBio}</p>
          )}

          {/* Performance stat strip */}
          {(p.fisPoints != null || p.worldRank != null || p.performance) && (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HeroStat label="FIS points" value={fmtPoints(p.fisPoints)} accent />
              <HeroStat label="World rank" value={p.worldRank != null ? `#${p.worldRank}` : "—"} />
              {p.performance && <HeroStat label="Podium rate" value={`${p.performance.podiumPct}%`} />}
              {p.performance && <HeroStat label="Races" value={String(p.performance.totalRaces)} />}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-12 px-5 py-12 md:px-12">
        {/* Academy recruiting banner */}
        {p.recruiting && <AcademyRecruitingBanner banner={p.recruiting} />}

        {/* Ranking */}
        {(p.fisPoints != null || p.worldRank != null || p.pointsEvolution) && (
          <section>
            <SectionTitle kicker="Performance" title="Ranking & trend" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Stat label="FIS points" value={fmtPoints(p.fisPoints)} />
              <Stat label="World rank" value={p.worldRank != null ? `#${p.worldRank}` : "—"} />
            </div>
            {p.pointsEvolution && (
              <div className="card mt-4 p-5">
                <div className="mb-3 text-sm font-semibold">FIS points trend <span className="text-xs font-normal text-[var(--color-muted)]">· lower is better</span></div>
                <GrowthChart data={p.pointsEvolution} />
              </div>
            )}
          </section>
        )}

        {/* Results */}
        {p.results && p.results.length > 0 && (
          <section>
            <SectionTitle kicker="Race record" title="Latest results" />
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Event</th>
                    <th className="px-3 py-3 font-medium">Discipline</th>
                    <th className="px-3 py-3 text-right font-medium">Rank</th>
                    <th className="px-3 py-3 text-right font-medium">FIS</th>
                  </tr>
                </thead>
                <tbody>
                  {p.results.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--color-border)] first:border-t-0">
                      <td className="px-5 py-3 text-[var(--color-muted)]">{fmtDate(r.date)}</td>
                      <td className="px-3 py-3">{r.eventName}<span className="block text-xs text-[var(--color-muted)]">{r.location}</span></td>
                      <td className="px-3 py-3 text-[var(--color-muted)]">{DISCIPLINE_LABEL[r.discipline] ?? r.discipline}</td>
                      <td className="num px-3 py-3 text-right font-semibold">{r.rank}</td>
                      <td className="num px-3 py-3 text-right">{r.fisPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Premium performance analytics */}
        {p.performance && p.performance.totalRaces > 0 && (
          <PerformanceAnalytics stats={p.performance} locked={!p.premiumUnlocked} />
        )}

        {/* Media */}
        {p.media && p.media.length > 0 && (
          <section>
            <SectionTitle kicker="Portfolio" title="Media" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {p.media.map((m) => (
                <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="card group overflow-hidden transition-colors hover:border-[var(--color-accent)]">
                  <div className="relative aspect-video bg-[var(--color-surface-2)]">
                    {m.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumbnailUrl} alt={m.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-[var(--color-muted)]">{MEDIA_ICON[m.type] ?? "▷"}</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <span className="truncate text-sm font-medium">{m.title}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{m.type}</span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* External profiles */}
        {p.externalLinks && (p.externalLinks.fisCode || p.externalLinks.fisProfileUrl || p.externalLinks.atpProfileUrl) && (
          <section>
            <SectionTitle kicker="Verified sources" title="External profiles" />
            {p.externalLinks.fisCode && (
              <div className="mb-3 text-sm text-[var(--color-muted)]">FIS code <span className="num font-semibold text-[var(--color-fg)]">{p.externalLinks.fisCode}</span></div>
            )}
            <div className="flex flex-wrap gap-3">
              {p.externalLinks.fisProfileUrl && <ExtLink href={p.externalLinks.fisProfileUrl} label="FIS profile" />}
              {p.externalLinks.atpProfileUrl && <ExtLink href={p.externalLinks.atpProfileUrl} label="ATP profile" />}
            </div>
          </section>
        )}

        {/* Contact / recruit */}
        {p.contactEnabled && (
          <section id="contact" className="card flex flex-col items-center gap-4 p-10 text-center">
            <h2 className="text-2xl font-bold">Interested in {p.firstName}?</h2>
            <p className="max-w-md text-sm text-[var(--color-muted)]">
              This athlete is open to recruiting conversations. Reach out through their academy to start a verified introduction.
            </p>
            <a href={`mailto:?subject=${encodeURIComponent(`Recruiting interest — ${p.firstName} ${p.lastName}`)}`} className="rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
              Request introduction
            </a>
          </section>
        )}
      </div>

      <footer className="border-t border-[var(--color-border)] px-5 py-6 text-center text-xs text-[var(--color-muted)] md:px-12">
        Powered by LEAF · Verified athlete profiles
      </footer>
    </div>
  );
}

const MEDIA_ICON: Record<string, string> = { IMAGE: "🖼", VIDEO: "▷", PDF: "📄", LINK: "🔗" };

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-5">
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>{kicker}</div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
    </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
      <div className="num mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface-2)]">
      {label} <span className="text-[var(--color-muted)]">↗</span>
    </a>
  );
}

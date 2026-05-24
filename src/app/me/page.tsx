import Link from "next/link";
import { redirect } from "next/navigation";
import { LeafMark } from "@/components/LeafMark";
import { signOut } from "@/app/auth-actions";
import { getSession, requireAthleteId } from "@/lib/auth";
import { getAthleteWorkspace } from "@/lib/athleteWorkspace";
import { sportConfig } from "@/lib/sport";
import { fmtPoints } from "@/lib/domain";
import { forecastTrajectory } from "@/lib/ai/forecast";
import { ForecastCard } from "@/components/ForecastCard";
import { deriveAthleteInsights } from "@/lib/ai/athleteInsights";
import { AthleteInsights } from "@/components/AthleteInsights";
import { deriveRecommendations } from "@/lib/ai/recommendations";
import { RecommendationsCard } from "@/components/RecommendationsCard";
import { MyProfileEditForm } from "@/components/MyProfileEditForm";
import { ShareButton } from "@/components/ShareButton";
import { getCalendarEvents } from "@/lib/calendar";
import { prisma } from "@/lib/db";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://leaf-saas-gbf8.vercel.app";

export const dynamic = "force-dynamic";
export const metadata = { title: "My profile — LEAF" };

export default async function MyProfilePage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: isNew } = await searchParams;
  const athleteId = await requireAthleteId();
  const s = await getSession();
  const w = await getAthleteWorkspace(athleteId);
  if (!w) redirect("/login");

  const cfg = sportConfig(w.sport);
  const initials = `${w.firstName[0] ?? ""}${w.lastName[0] ?? ""}`.toUpperCase();
  const forecast = w.pointsEvolution.length ? forecastTrajectory(w.pointsEvolution, w.sport) : null;

  // Calendar — upcoming events for this athlete's groups + academy-wide.
  const enr = await prisma.enrollment.findFirst({ where: { athleteId }, select: { academyId: true } });
  const upcoming = enr
    ? (await getCalendarEvents({ kind: "athlete", academyId: enr.academyId, athleteId }, { upcomingOnly: true })).slice(0, 6)
    : [];

  return (
    <div className="min-h-screen">
      {/* Workspace header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-5 py-3.5 backdrop-blur md:px-12">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <LeafMark size={26} />
          <div className="leading-tight">
            <div className="text-sm font-bold">LEAF</div>
            <div className="text-[11px] text-[var(--color-muted)]">My profile</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {w.slug && (
            <>
              <ShareButton url={`${baseUrl}/athlete/${w.slug}`} label="Copy link" className="hidden rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:border-[var(--color-accent)] sm:inline-flex" />
              <Link href={`/athlete/${w.slug}`} target="_blank" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface)]">
                View public profile ↗
              </Link>
            </>
          )}
          <form action={signOut}>
            <button type="submit" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface)]">Sign out</button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-10 px-5 py-10 md:px-12">
        {isNew && (
          <div className="rounded-xl border border-[var(--color-accent)]/30 p-4" style={{ background: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }}>
            <span className="text-sm font-semibold text-[var(--color-accent)]">✓ Welcome to LEAF.</span>{" "}
            <span className="text-sm text-[var(--color-fg)]/85">Your verified profile is live. Fill in your bio and photo below, then share your public link.</span>
          </div>
        )}

        {/* Identity + stats */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl ring-1 ring-[var(--color-border)]">
            {w.publicPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.publicPhotoUrl} alt={`${w.firstName} ${w.lastName}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-black" style={{ background: w.photoColor, color: "#fff" }}>{initials}</div>
            )}
          </div>
          <div className="flex-1">
            <div className="kicker" style={{ color: "var(--color-accent)" }}>Welcome back</div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="display text-3xl font-bold md:text-4xl">{w.firstName} {w.lastName}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={w.publicProfileEnabled && w.publicVisibility === "PUBLIC"
                  ? { background: "#7cff6b1a", color: "var(--color-accent)" }
                  : { background: "#f59e0b1a", color: "#f59e0b" }}>
                {w.publicProfileEnabled && w.publicVisibility === "PUBLIC" ? "● Public" : "● Hidden"}
              </span>
            </div>
            <div className="mt-1 text-sm text-[var(--color-muted)]">
              {cfg.label} · {cfg.pointsLabel} {fmtPoints(w.fisPoints)} · {cfg.rankLabel} {w.worldRank != null ? `#${w.worldRank}` : "—"}
            </div>
          </div>
        </div>

        {!w.publicProfileEnabled && (
          <div className="card border-[#f59e0b]/40 p-4 text-sm" style={{ background: "#f59e0b12" }}>
            Your public profile is currently hidden. Ask your academy or contact support to publish it.
          </div>
        )}

        {/* AI layer — same intelligence the athlete shows publicly */}
        {w.performance && (
          <div className="border-t border-[var(--color-border)] pt-8">
            <div className="kicker" style={{ color: "var(--color-accent)" }}>Your performance · by LEAF AI</div>
            <h2 className="display mt-1 text-2xl font-bold">What your record says about you</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">The same intelligence academies and scouts see on your profile.</p>
          </div>
        )}
        {w.performance && forecast && (
          <section className="space-y-4">
            <ForecastCard forecast={forecast} pointsLabel={cfg.pointsLabel} />
          </section>
        )}
        {w.performance && (
          <AthleteInsights insights={deriveAthleteInsights(w.performance, { sport: w.sport, worldRank: w.worldRank })} />
        )}
        {w.performance && forecast && (
          <RecommendationsCard recommendations={deriveRecommendations(w.performance, forecast, w.sport)} />
        )}

        {/* My calendar — events from my groups + academy-wide */}
        {upcoming.length > 0 && (
          <div className="border-t border-[var(--color-border)] pt-8">
            <div className="kicker" style={{ color: "var(--color-accent)" }}>My calendar</div>
            <h2 className="display mt-1 text-2xl font-bold">What&apos;s coming up</h2>
            <div className="card mt-4 divide-y divide-[var(--color-border)] overflow-hidden">
              {upcoming.map((e) => {
                const start = new Date(e.startDate);
                const end = e.endDate ? new Date(e.endDate) : null;
                const sameDay = !end || start.toDateString() === end.toDateString();
                const dateLabel = sameDay
                  ? start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                  : `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${end!.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
                return (
                  <div key={e.id} className="flex items-start gap-4 px-4 py-3">
                    <div className="w-32 shrink-0 text-xs font-semibold">{dateLabel}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{e.title}</span>
                        <span className="rounded-md bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">{e.type}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                        {e.group ? e.group.name : "Academy-wide"}
                        {e.location ? ` · ${e.location}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Editable fields */}
        <MyProfileEditForm initial={{ publicBio: w.publicBio, publicPhotoUrl: w.publicPhotoUrl, publicContactEnabled: w.publicContactEnabled }} />

        <p className="text-center text-xs text-[var(--color-muted)]">Signed in as {s?.name}</p>
      </div>
    </div>
  );
}

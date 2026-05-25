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
import { athleteStatusLabel } from "@/lib/athleteStatus";

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
          {/* Sharing UI only renders when the platform has enabled public
              profiles for one of the athlete's enrolled academies. The
              feature stays off by default until the discovery / marketplace
              layer is live — surfaces are honest about availability. */}
          {w.featurePublicProfilesAvailable && w.slug && (
            <>
              <ShareButton url={`${baseUrl}/athlete/${w.slug}`} label="Copy link" className="inline-flex rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:border-[var(--color-accent)]" />
              <Link
                href={`/athlete/${w.slug}`}
                target="_blank"
                title="Opens the filtered view that scouts and academies see when you share your link"
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface)]"
              >
                Preview as a scout sees it ↗
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
              {/* Status badge — the canonical "what tier am I" indicator.
                  Drives section visibility downstream (lib/athleteStatus.ts):
                  free → basic AI · premium → advanced AI · enrolled →
                  everything + academy modules. */}
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={
                  w.status === "enrolled"
                    ? { background: "#7cff6b1a", color: "var(--color-accent)" }
                    : w.status === "premium"
                      ? { background: "#fde68a14", color: "#fbbf24" }
                      : { background: "var(--color-surface-2)", color: "var(--color-muted)" }
                }
                title="Status drives which sections are unlocked"
              >
                {athleteStatusLabel(w.status)}
              </span>
              {w.featurePublicProfilesAvailable && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={w.publicProfileEnabled && w.publicVisibility === "PUBLIC"
                    ? { background: "#7cff6b1a", color: "var(--color-accent)" }
                    : { background: "#f59e0b1a", color: "#f59e0b" }}>
                  {w.publicProfileEnabled && w.publicVisibility === "PUBLIC" ? "● Public" : "● Hidden"}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-[var(--color-muted)]">
              {cfg.label} · {cfg.pointsLabel} {fmtPoints(w.fisPoints)} · {cfg.rankLabel} {w.worldRank != null ? `#${w.worldRank}` : "—"}
            </div>
          </div>
        </div>

        {/* Public-profile messaging only renders when the platform feature
            is available to this athlete's academy. Otherwise the workspace
            keeps the AI/calendar/edit-bio surfaces and stays silent on the
            sharing story until the marketplace is live. */}
        {w.featurePublicProfilesAvailable && !w.publicProfileEnabled && (
          <div className="card border-[#f59e0b]/40 p-4 text-sm" style={{ background: "#f59e0b12" }}>
            Your public profile is currently hidden. Ask your academy or contact support to publish it.
          </div>
        )}

        {/* "What scouts & academies see" — same underlying athlete, filtered
            view. Explicit visibility checklist so the athlete is never
            confused about what's exposed vs what stays private. */}
        {w.featurePublicProfilesAvailable && w.publicProfileEnabled && w.slug && (
          <div className="card p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="kicker" style={{ color: "var(--color-accent)" }}>What scouts &amp; academies see</div>
                <h2 className="mt-1 text-lg font-semibold">Your public profile — a filtered view of you</h2>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  This is the same profile as below, with only the fields you allowed.
                  Share the link with scouts and they see exactly the preview.
                </p>
              </div>
              <Link
                href={`/athlete/${w.slug}`}
                target="_blank"
                className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]"
              >
                Preview ↗
              </Link>
            </div>

            {/* Share link row */}
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
              <span className="num truncate text-xs text-[var(--color-muted)]">{baseUrl}/athlete/{w.slug}</span>
              <div className="ml-auto shrink-0">
                <ShareButton url={`${baseUrl}/athlete/${w.slug}`} label="Copy link" className="rounded-md bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]" />
              </div>
            </div>

            {/* Visibility checklist — what's on the public view vs hidden */}
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">What&apos;s visible</div>
              <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
                <VisibilityRow on={true} label="Name, sport, nationality" hint="always public" />
                <VisibilityRow on={!!w.publicPhotoUrl} label="Photo" hint={w.publicPhotoUrl ? "shown" : "add a photo below"} />
                <VisibilityRow on={!!w.publicBio} label="Bio" hint={w.publicBio ? "shown" : "add a bio below"} />
                <VisibilityRow on={w.publicShowRanking} label={`${cfg.pointsLabel} & ${cfg.rankLabel.toLowerCase()}`} />
                <VisibilityRow on={w.publicShowResults} label="Recent results" />
                <VisibilityRow on={w.publicShowMedia} label="Media gallery" />
                <VisibilityRow on={w.publicShowAcademy} label="Academy name" />
                <VisibilityRow on={w.publicShowExternalProfiles} label={cfg.profileLinkLabel} />
                <VisibilityRow on={w.publicContactEnabled} label="Contact button" hint="you can toggle below" />
              </ul>
              <p className="mt-3 text-[10px] text-[var(--color-muted)]">
                Most toggles are managed by your academy. You can change <span className="text-[var(--color-fg)]">Photo</span>, <span className="text-[var(--color-fg)]">Bio</span> and <span className="text-[var(--color-fg)]">Contact button</span> yourself below; ask your academy to adjust the rest.
              </p>
            </div>
          </div>
        )}

        {/* ── My team — unlocked when status === 'enrolled' ────────────────
            Shows the academy/coach/group this athlete trains with. Single
            entry to /academy/[slug] for context, no admin actions here. */}
        {w.capabilities.academyModules && w.enrolledAcademy && (
          <div className="card p-5">
            <div className="kicker mb-2" style={{ color: "var(--color-accent)" }}>My team</div>
            <div className="flex flex-wrap items-center gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-black"
                style={{ background: w.enrolledAcademy.logoColor, color: "#0a0c10" }}
              >
                {w.enrolledAcademy.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold">{w.enrolledAcademy.name}</div>
                <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {w.groupName ? <>Group: <span className="text-[var(--color-fg)]">{w.groupName}</span></> : "No group assigned yet"}
                  {w.coachName && <> · Coach: <span className="text-[var(--color-fg)]">{w.coachName}</span></>}
                </div>
              </div>
              <Link
                href={`/academy/${w.enrolledAcademy.slug}`}
                target="_blank"
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]"
              >
                Academy page ↗
              </Link>
            </div>
          </div>
        )}

        {/* AI layer — basic insights always render when there's data; advanced
            forecast + recommendations are gated behind capabilities.advancedAi
            (premium / enrolled). Free athletes see the upgrade prompt. */}
        {w.performance && (
          <div className="border-t border-[var(--color-border)] pt-8">
            <div className="kicker" style={{ color: "var(--color-accent)" }}>Your performance · by LEAF AI</div>
            <h2 className="display mt-1 text-2xl font-bold">What your record says about you</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {w.capabilities.advancedAi
                ? "Forecast, recommendations and deep insights — the same intelligence academies see."
                : "Basic trend insights. Upgrade for forecast, recommendations and predictive trends."}
            </p>
          </div>
        )}
        {w.performance && forecast && w.capabilities.advancedAi && (
          <section className="space-y-4">
            <ForecastCard forecast={forecast} pointsLabel={cfg.pointsLabel} />
          </section>
        )}
        {w.performance && (
          <AthleteInsights insights={deriveAthleteInsights(w.performance, { sport: w.sport, worldRank: w.worldRank })} />
        )}
        {w.performance && forecast && w.capabilities.advancedAi && (
          <RecommendationsCard recommendations={deriveRecommendations(w.performance, forecast, w.sport)} />
        )}

        {/* Premium upgrade CTA — only when the athlete is genuinely 'free'
            (not enrolled, not yet premium). Enrolled athletes get premium for
            free via lib/athleteStatus.ts, so the CTA stays hidden for them. */}
        {w.capabilities.showUpgradeCTA && w.performance && (
          <div className="card border-[#fbbf24]/30 p-5" style={{ background: "color-mix(in srgb, #fbbf24 6%, transparent)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="kicker" style={{ color: "#fbbf24" }}>Unlock Premium</div>
                <h3 className="mt-1 text-lg font-semibold">Predictive trends, season comparisons, recommendations</h3>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Get the AI forecast on where your trajectory is heading, plus the same recommendations academies use to build their plan.
                </p>
              </div>
              <button
                type="button"
                disabled
                title="Premium subscriptions open soon — enroll with an academy to unlock today."
                className="shrink-0 rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/10 px-3 py-1.5 text-xs font-semibold text-[#fbbf24] opacity-80"
              >
                Coming soon
              </button>
            </div>
          </div>
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

// One row in the "What's visible" checklist. Green when the field is publicly
// visible, muted when it's hidden. Optional hint surfaces the next action
// the athlete can take (add a photo, ask their academy, ...).
function VisibilityRow({ on, label, hint }: { on: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
        style={{
          background: on ? "color-mix(in srgb, var(--color-accent) 22%, transparent)" : "var(--color-surface-2)",
          color: on ? "var(--color-accent)" : "var(--color-muted)",
        }}
      >
        {on ? "✓" : "✕"}
      </span>
      <span className="min-w-0">
        <span className={on ? "" : "text-[var(--color-muted)] line-through decoration-[var(--color-muted)]/40"}>{label}</span>
        {hint && <span className="ml-1 text-[10px] text-[var(--color-muted)]">· {hint}</span>}
      </span>
    </li>
  );
}

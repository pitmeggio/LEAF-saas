import { prisma } from "@/lib/db";
import { computePerformance, type PerformanceStats } from "@/lib/performance";
import { getAthleteStatus, deriveAthleteCapabilities, type AthleteStatus, type AthleteCapabilities } from "@/lib/athleteStatus";

// Owner-view of an athlete's own profile for the /me workspace. Unlike the public
// read layer this returns the editable fields too (the athlete owns this data).
export type AthleteWorkspace = {
  athleteId: string;
  slug: string | null;
  firstName: string;
  lastName: string;
  sport: string;
  photoColor: string;
  verified: boolean;
  publicProfileEnabled: boolean;
  publicVisibility: string;
  // Platform-level gate — true when at least one of the athlete's enrolled
  // academies has the featurePublicProfiles flag on. /me uses this to hide
  // the share / preview UI when the marketplace surface isn't live for the
  // athlete's academy.
  featurePublicProfilesAvailable: boolean;
  // editable
  publicBio: string | null;
  publicPhotoUrl: string | null;
  publicContactEnabled: boolean;
  // privacy toggles — surfaced so /me can show the athlete a "what's
  // visible to scouts" checklist. Mutating these is academy-side today
  // (admin manages publicShow* flags on members/[id]); the workspace
  // only reads them so the athlete is never confused about what's exposed.
  publicShowAcademy: boolean;
  publicShowRanking: boolean;
  publicShowResults: boolean;
  publicShowMedia: boolean;
  publicShowExternalProfiles: boolean;
  // performance
  fisPoints: number | null;
  worldRank: number | null;
  fisCode: string | null;
  pointsEvolution: { label: string; fisPoints: number }[];
  performance: PerformanceStats | null;
  // ── Status & capabilities — the canonical access tier for this athlete ──
  // /me uses these to decide which sections render. Free / Premium / Enrolled
  // is a single derivation rule (lib/athleteStatus.ts); every surface goes
  // through it so the same athlete sees the same modules everywhere.
  status: AthleteStatus;
  capabilities: AthleteCapabilities;
  // ── Enrolled-context (populated when status === 'enrolled') ──
  // The primary academy / group / coach for the workspace. When the athlete
  // belongs to multiple academies we pick the first active enrolment as the
  // 'home' one — multi-academy presentation is a future enhancement.
  enrolledAcademy: { id: string; name: string; slug: string; logoColor: string } | null;
  groupName: string | null;
  coachName: string | null;
};

export async function getAthleteWorkspace(athleteId: string): Promise<AthleteWorkspace | null> {
  const a = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: {
      results: { orderBy: { date: "desc" }, take: 60 },
      rankings: { orderBy: { date: "asc" }, select: { date: true, fisPoints: true } },
      enrollments: {
        // Order by joinDate desc so the most recent active enrolment is the
        // 'home' academy in the workspace. status filtering keeps churned
        // members from polluting capability + context.
        where: { status: { in: ["active", "injured", "paused"] } },
        orderBy: { joinDate: "desc" },
        select: {
          academy: { select: { id: true, name: true, slug: true, logoColor: true, featurePublicProfiles: true } },
          group: { select: { name: true } },
          coach: { select: { name: true } },
        },
      },
    },
  });
  if (!a) return null;
  const featurePublicProfilesAvailable = a.enrollments.some((e) => e.academy?.featurePublicProfiles);

  // Status — derived from the enrolment count. premiumSubscriber stays false
  // until payment integration lands; enrolled athletes get premium for free
  // via the rule in lib/athleteStatus.ts.
  const status = getAthleteStatus({ enrolledAcademiesCount: a.enrollments.length });
  const capabilities = deriveAthleteCapabilities(status);
  const primary = a.enrollments[0] ?? null;

  const perf = computePerformance(
    a.results.map((r) => ({ date: r.date, discipline: r.discipline, rank: r.rank, fisPoints: r.fisPoints, status: r.status })),
    a.rankings.map((r) => ({ date: r.date, fisPoints: r.fisPoints })),
  );

  return {
    athleteId: a.id,
    slug: a.publicSlug,
    firstName: a.firstName,
    lastName: a.lastName,
    sport: a.sport,
    photoColor: a.photoColor,
    verified: a.publicVerified,
    publicProfileEnabled: a.publicProfileEnabled,
    publicVisibility: a.publicVisibility,
    featurePublicProfilesAvailable,
    publicBio: a.publicBio,
    publicPhotoUrl: a.publicPhotoUrl,
    publicContactEnabled: a.publicContactEnabled,
    publicShowAcademy: a.publicShowAcademy,
    publicShowRanking: a.publicShowRanking,
    publicShowResults: a.publicShowResults,
    publicShowMedia: a.publicShowMedia,
    publicShowExternalProfiles: a.publicShowExternalProfiles,
    fisPoints: a.fisPoints,
    worldRank: a.worldRank,
    fisCode: a.fisCode,
    pointsEvolution: perf.pointsEvolution,
    performance: perf.totalRaces > 0 ? perf : null,
    status,
    capabilities,
    enrolledAcademy: primary?.academy
      ? {
          id: primary.academy.id,
          name: primary.academy.name,
          slug: primary.academy.slug,
          logoColor: primary.academy.logoColor,
        }
      : null,
    groupName: primary?.group?.name ?? null,
    coachName: primary?.coach?.name ?? null,
  };
}

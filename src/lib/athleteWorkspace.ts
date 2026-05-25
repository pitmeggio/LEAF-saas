import { prisma } from "@/lib/db";
import { computePerformance, type PerformanceStats } from "@/lib/performance";

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
};

export async function getAthleteWorkspace(athleteId: string): Promise<AthleteWorkspace | null> {
  const a = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: {
      results: { orderBy: { date: "desc" }, take: 60 },
      rankings: { orderBy: { date: "asc" }, select: { date: true, fisPoints: true } },
    },
  });
  if (!a) return null;

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
  };
}

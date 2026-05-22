import { prisma } from "@/lib/db";
import { suggestGroups, type AthleteInput, type GroupInput } from "@/lib/ai/groupAssignment";
import { trendFromPoints } from "@/lib/domain";

// Auto group placement used at application intake. Unlike getGroupsForAssignment()
// (session-scoped, for the dashboard), this takes an explicit academyId so it can run
// from the public application flow where there is no admin session.

export async function groupInputsForAcademy(academyId: string): Promise<GroupInput[]> {
  const groups = await prisma.group.findMany({
    where: { academyId, active: true },
    include: { coach: { select: { name: true } }, _count: { select: { enrollments: { where: { status: "active" } } } } },
    orderBy: { name: "asc" },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    sport: g.sport,
    capacity: g.capacity,
    enrolledCount: g._count.enrollments,
    pointsMin: g.pointsMin,
    pointsMax: g.pointsMax,
    ageMin: g.ageMin,
    ageMax: g.ageMax,
    discipline: g.discipline,
    level: g.level,
    coachName: g.coach?.name ?? null,
  }));
}

function ageFromDob(dob: Date | null | undefined): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

// Build the recommender input from an athlete id (loads points/dob/discipline + trend).
export async function athleteInputFor(athleteId: string): Promise<AthleteInput | null> {
  const a = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { sport: true, fisPoints: true, dob: true, discipline: true, rankings: { orderBy: { date: "asc" }, select: { fisPoints: true } } },
  });
  if (!a) return null;
  let trendDeltaPoints: number | null = null;
  if (a.rankings.length >= 2) {
    trendDeltaPoints = trendFromPoints(a.rankings[0].fisPoints, a.rankings[a.rankings.length - 1].fisPoints).deltaPoints;
  }
  return { sport: a.sport, points: a.fisPoints, age: ageFromDob(a.dob), discipline: a.discipline, trendDeltaPoints };
}

// The auto-placement decision: the best ELIGIBLE group (hard mismatches — wrong sport,
// full, discipline clash — are already excluded by the engine). Returns null when no
// group fits, leaving the candidate unassigned for manual placement.
export async function computeSuggestedGroupId(academyId: string, athleteId: string): Promise<string | null> {
  const [groups, athlete] = await Promise.all([groupInputsForAcademy(academyId), athleteInputFor(athleteId)]);
  if (!groups.length || !athlete) return null;
  const ranked = suggestGroups(athlete, groups);
  const best = ranked.find((s) => s.recommended) ?? ranked.find((s) => s.eligible);
  return best?.groupId ?? null;
}

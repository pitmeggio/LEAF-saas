import { prisma } from "@/lib/db";

// Calendar visibility rules:
//  • admin  → every event in the academy
//  • coach  → events for groups they coach + academy-wide (groupId null)
//  • athlete → events for groups they're enrolled in + academy-wide

export type CalendarScope =
  | { kind: "admin"; academyId: string }
  | { kind: "coach"; academyId: string; coachId: string }
  | { kind: "athlete"; academyId: string; athleteId: string };

export async function getCalendarEvents(scope: CalendarScope, opts: { upcomingOnly?: boolean; season?: string; groupId?: string } = {}) {
  const where: Record<string, unknown> = { academyId: scope.academyId };
  if (opts.season && opts.season !== "all") where.season = opts.season;
  if (opts.groupId) where.groupId = opts.groupId;
  if (opts.upcomingOnly) {
    // Show events that haven't fully ended yet: endDate >= now, or no endDate and startDate >= now.
    const now = new Date();
    where.OR = [
      { endDate: { gte: now } },
      { AND: [{ endDate: null }, { startDate: { gte: now } }] },
    ];
  }

  if (scope.kind === "coach") {
    const groups = await prisma.group.findMany({ where: { academyId: scope.academyId, coachId: scope.coachId }, select: { id: true } });
    const groupIds = groups.map((g) => g.id);
    where.AND = [
      ...((where.AND as object[]) ?? []),
      { OR: [{ groupId: null }, { groupId: { in: groupIds } }, { coachId: scope.coachId }] },
    ];
  } else if (scope.kind === "athlete") {
    const enrollments = await prisma.enrollment.findMany({
      where: { athleteId: scope.athleteId, academyId: scope.academyId },
      select: { groupId: true },
    });
    const groupIds = enrollments.map((e) => e.groupId).filter((id): id is string => !!id);
    where.AND = [
      ...((where.AND as object[]) ?? []),
      { OR: [{ groupId: null }, { groupId: { in: groupIds } }] },
    ];
  }

  return prisma.calendarEvent.findMany({
    where,
    include: { group: { select: { id: true, name: true } }, coach: { select: { id: true, name: true } } },
    orderBy: { startDate: "asc" },
  });
}

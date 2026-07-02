import { prisma } from "@/lib/db";
import type { AnnouncementView, ReceiptStat, StaffBoard, RsvpStatus, RsvpSummary } from "./boardTypes";

// Server read layer for the Bacheca (Squad Board). Announcements + event RSVP.

// The Bacheca tables (Announcement / AnnouncementReceipt / EventRsvp) are added
// additively; until the schema is pushed to the shared DB they don't exist yet.
// This wrapper keeps existing always-loaded pages (the athlete home + app shell,
// which read the board on every render) from crashing during that window —
// "table does not exist" degrades to an empty result instead of a 500.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const code = (e as { code?: string })?.code;
    const msg = (e as { message?: string })?.message ?? "";
    if (code === "P2021" || /does not exist|relation .* does not exist/i.test(msg)) return fallback;
    throw e;
  }
}

// Resolve the athlete's tenant + the groups they belong to, spanning both the
// ski path (Enrollment) and the tennis path (TennisSeasonPlan, no enrollment).
// Announcements target either the whole academy (audience "all") or a group.
export async function resolveAthleteContext(
  athleteId: string,
): Promise<{ academyId: string | null; groupIds: string[] }> {
  const [enrs, plan] = await Promise.all([
    prisma.enrollment.findMany({ where: { athleteId }, select: { academyId: true, groupId: true } }),
    prisma.tennisSeasonPlan.findFirst({ where: { athleteId }, select: { academyId: true } }),
  ]);
  const academyId = enrs[0]?.academyId ?? plan?.academyId ?? null;
  const groupIds = enrs.map((e) => e.groupId).filter((g): g is string => !!g);
  return { academyId, groupIds };
}

// Roster of an academy (ski ∪ tennis) — the denominator for read/ack stats.
async function rosterIds(academyId: string, groupId?: string | null): Promise<string[]> {
  if (groupId) {
    const enr = await prisma.enrollment.findMany({ where: { academyId, groupId }, select: { athleteId: true } });
    return [...new Set(enr.map((e) => e.athleteId))];
  }
  const [enr, plans] = await Promise.all([
    prisma.enrollment.findMany({ where: { academyId }, select: { athleteId: true } }),
    prisma.tennisSeasonPlan.findMany({ where: { academyId }, select: { athleteId: true } }),
  ]);
  return [...new Set([...enr.map((e) => e.athleteId), ...plans.map((p) => p.athleteId)])];
}

// ── Athlete side ───────────────────────────────────────────────────────────

// Announcements the athlete should see: academy-wide OR targeted to one of
// their groups. Newest first, pinned floated to the top. Includes their own
// read/ack state (from AnnouncementReceipt).
export async function getAthleteBoard(athleteId: string): Promise<AnnouncementView[]> {
  const { academyId, groupIds } = await resolveAthleteContext(athleteId);
  if (!academyId) return [];

  const rows = await safe(() => prisma.announcement.findMany({
    where: {
      academyId,
      OR: [{ audience: "all" }, { audience: "group", groupId: { in: groupIds.length ? groupIds : ["__none__"] } }],
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 60,
    include: { receipts: { where: { athleteId }, select: { readAt: true, ackedAt: true } } },
  }), [] as never[]);

  const groupNames = groupIds.length
    ? new Map((await prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } })).map((g) => [g.id, g.name]))
    : new Map<string, string>();

  return rows.map((r) => {
    const receipt = r.receipts[0];
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      authorName: r.authorName,
      authorRole: r.authorRole,
      audienceLabel: r.audience === "group" && r.groupId ? (groupNames.get(r.groupId) ?? "Gruppo") : "Tutta l'academy",
      pinned: r.pinned,
      requireAck: r.requireAck,
      createdAt: r.createdAt.toISOString(),
      read: !!receipt,
      acked: !!receipt?.ackedAt,
    };
  });
}

export async function countUnread(athleteId: string): Promise<number> {
  const board = await getAthleteBoard(athleteId);
  return board.filter((a) => !a.read).length;
}

// The athlete's RSVP state for a set of CalendarEvent ids → { eventId: status }.
export async function getAthleteRsvps(athleteId: string, eventIds: string[]): Promise<Record<string, RsvpStatus>> {
  if (eventIds.length === 0) return {};
  const rows = await safe(() => prisma.eventRsvp.findMany({
    where: { athleteId, eventId: { in: eventIds } },
    select: { eventId: true, status: true },
  }), [] as { eventId: string; status: string }[]);
  const out: Record<string, RsvpStatus> = {};
  for (const r of rows) out[r.eventId] = r.status as RsvpStatus;
  return out;
}

// ── Staff side ───────────────────────────────────────────────────────────

export async function getStaffBoard(academyId: string): Promise<StaffBoard> {
  const [rows, groups, roster] = await Promise.all([
    safe(() => prisma.announcement.findMany({
      where: { academyId },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 60,
      include: { receipts: { select: { readAt: true, ackedAt: true } } },
    }), [] as never[]),
    prisma.group.findMany({ where: { academyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    rosterIds(academyId),
  ]);

  const groupNames = new Map(groups.map((g) => [g.id, g.name]));
  // Group audience sizes are computed lazily only for group-targeted posts.
  const groupSizeCache = new Map<string, number>();
  const announcements: ReceiptStat[] = [];
  for (const r of rows) {
    let audienceSize = roster.length;
    let audienceLabel = "Tutta l'academy";
    if (r.audience === "group" && r.groupId) {
      audienceLabel = groupNames.get(r.groupId) ?? "Gruppo";
      if (!groupSizeCache.has(r.groupId)) groupSizeCache.set(r.groupId, (await rosterIds(academyId, r.groupId)).length);
      audienceSize = groupSizeCache.get(r.groupId)!;
    }
    announcements.push({
      id: r.id,
      title: r.title,
      body: r.body,
      authorName: r.authorName,
      authorRole: r.authorRole,
      audienceLabel,
      pinned: r.pinned,
      requireAck: r.requireAck,
      createdAt: r.createdAt.toISOString(),
      audienceSize,
      readCount: r.receipts.length,
      ackCount: r.receipts.filter((x) => x.ackedAt).length,
    });
  }

  return { announcements, groups, rosterSize: roster.length };
}

// RSVP roll-up for a single event, including who has not yet responded.
export async function getEventRsvpSummary(academyId: string, eventId: string, groupId?: string | null): Promise<RsvpSummary> {
  const [rsvps, roster] = await Promise.all([
    safe(() => prisma.eventRsvp.findMany({ where: { academyId, eventId }, select: { athleteId: true, status: true } }), [] as { athleteId: string; status: string }[]),
    rosterIds(academyId, groupId ?? null),
  ]);
  const byId = new Map(rsvps.map((r) => [r.athleteId, r.status as RsvpStatus]));
  const names = new Map(
    (await prisma.athlete.findMany({ where: { id: { in: roster } }, select: { id: true, firstName: true, lastName: true } }))
      .map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim()]),
  );
  const responders = roster
    .filter((id) => byId.has(id))
    .map((id) => ({ athleteId: id, name: names.get(id) ?? "Atleta", status: byId.get(id)! }));
  const count = (s: RsvpStatus) => responders.filter((r) => r.status === s).length;
  return {
    going: count("going"),
    maybe: count("maybe"),
    not: count("not"),
    pending: roster.filter((id) => !byId.has(id)).length,
    responders,
  };
}

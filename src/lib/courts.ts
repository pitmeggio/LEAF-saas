import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";

// Times are stored as "wall-clock UTC" — built/read with UTC methods so the
// hour shown is the hour stored, regardless of server timezone. A booking grid
// is a wall clock, not an instant-in-time.

export type CourtCol = { id: string; label: string; facility: string; surface: string | null; indoor: boolean };

export async function getCourtsForBooking(): Promise<CourtCol[]> {
  const academyId = await requireAcademyId();
  const facilities = await prisma.tennisFacility.findMany({
    where: { academyId, active: true },
    include: { courts: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  const cols: CourtCol[] = [];
  for (const f of facilities) for (const c of f.courts) {
    cols.push({ id: c.id, label: c.label, facility: f.name, surface: c.surface, indoor: c.indoor });
  }
  return cols;
}

export type CourtBookingView = {
  id: string; courtId: string; startMin: number; endMin: number;
  type: string; title: string | null; groupName: string | null; seriesId: string | null;
};

function dayBaseUTC(dateISO: string): number {
  const m = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// All bookings on one day (all courts) for the academy.
export async function getCourtBookingsForDay(dateISO: string): Promise<CourtBookingView[]> {
  const academyId = await requireAcademyId();
  const dayStart = new Date(dayBaseUTC(dateISO));
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const rows = await prisma.courtBooking.findMany({
    where: { academyId, startAt: { gte: dayStart, lt: dayEnd } },
    include: { group: { select: { name: true } } },
    orderBy: { startAt: "asc" },
  });
  return rows.map((r) => {
    const startMin = r.startAt.getUTCHours() * 60 + r.startAt.getUTCMinutes();
    let endMin = r.endAt.getUTCHours() * 60 + r.endAt.getUTCMinutes();
    if (endMin <= startMin) endMin = startMin + 60;
    return { id: r.id, courtId: r.courtId, startMin, endMin, type: r.discipline ?? "lesson", title: r.label, groupName: r.group?.name ?? null, seriesId: r.seriesId };
  });
}

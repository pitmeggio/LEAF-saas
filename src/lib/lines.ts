import { prisma } from "@/lib/db";

// Read-side queries for the LEAF OS Essential ski/line workspace.
//
// Two main shapes:
//   • getSlopesWithLines — anagrafica: list of slopes with their ordered lines
//   • getWeeklySchedule  — bookings for a given week, indexed by [lineId][timeKey]
//     so the page can render the Treningsskjema grid in O(1) per cell

export type SlopeWithLines = {
  id: string;
  name: string;
  facility: string | null;
  active: boolean;
  lines: { id: string; label: string; position: number }[];
};

export async function getSlopesWithLines(academyId: string): Promise<SlopeWithLines[]> {
  const slopes = await prisma.trainingSlope.findMany({
    where: { academyId },
    include: { lines: { orderBy: { position: "asc" } } },
    orderBy: { name: "asc" },
  });
  return slopes.map((s) => ({
    id: s.id,
    name: s.name,
    facility: s.facility,
    active: s.active,
    lines: s.lines.map((l) => ({ id: l.id, label: l.label, position: l.position })),
  }));
}

// The schedule slots a Trysil-style weekly grid expects. Each entry is a
// pre-built time band ("09:00 - 11:00"); the page maps each cell to a
// booking via the (lineId, dayKey, slotKey) tuple. Keep the slots short
// enough that the grid stays readable on a laptop screen.
export const DEFAULT_TIME_SLOTS: { key: string; label: string; startHour: number; startMin: number; endHour: number; endMin: number }[] = [
  { key: "08-11", label: "08:00 – 11:00", startHour: 8, startMin: 0, endHour: 11, endMin: 0 },
  { key: "09-11", label: "09:00 – 11:00", startHour: 9, startMin: 0, endHour: 11, endMin: 0 },
  { key: "11-13", label: "11:00 – 13:00", startHour: 11, startMin: 0, endHour: 13, endMin: 0 },
  { key: "13-15", label: "13:00 – 15:00", startHour: 13, startMin: 0, endHour: 15, endMin: 0 },
  { key: "15-16:30", label: "15:00 – 16:30", startHour: 15, startMin: 0, endHour: 16, endMin: 30 },
  { key: "18-20", label: "18:00 – 20:00", startHour: 18, startMin: 0, endHour: 20, endMin: 0 },
];

export type WeeklyBookingCell = {
  id: string;
  label: string | null;             // "TRA", "DEV GS", "TECH SL", or customer initials
  discipline: string | null;
  groupId: string | null;
  groupName: string | null;
  payAndTrainEnabled: boolean;
  customerName: string | null;
  status: string;
  publicPrice: number | null;
  notes: string | null;
};

export type WeeklySchedule = {
  weekStart: Date;
  slopes: SlopeWithLines[];
  // Map: lineId → dayIndex (0=Mon) → list of bookings overlapping that day
  byLineDay: Map<string, Map<number, WeeklyBookingCell[]>>;
  // Bookings keyed by (lineId, dayIndex, exact-start-hour-min). Used for
  // fast lookup when the grid renders a cell — overlapping bookings show
  // as stacked chips.
  byLineDaySlot: Map<string, WeeklyBookingCell & { startAt: Date; endAt: Date }[]>;
};

export function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // Monday = 1; Sunday = 0 → previous Monday is 6 days back
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function dayKey(weekStart: Date, dayIndex: number): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

export type BookingWithMeta = {
  id: string;
  lineId: string;
  startAt: Date;
  endAt: Date;
  label: string | null;
  discipline: string | null;
  groupId: string | null;
  groupName: string | null;
  payAndTrainEnabled: boolean;
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  publicPrice: number | null;
  notes: string | null;
};

export async function getWeeklySchedule(academyId: string, weekStart: Date): Promise<{
  slopes: SlopeWithLines[];
  bookings: BookingWithMeta[];
  weekStart: Date;
  weekEnd: Date;
}> {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const [slopes, bookings] = await Promise.all([
    getSlopesWithLines(academyId),
    prisma.lineBooking.findMany({
      where: {
        academyId,
        startAt: { gte: start, lt: end },
      },
      include: { group: { select: { id: true, name: true } } },
      orderBy: [{ startAt: "asc" }],
    }),
  ]);

  return {
    slopes,
    weekStart: start,
    weekEnd: end,
    bookings: bookings.map((b) => ({
      id: b.id,
      lineId: b.lineId,
      startAt: b.startAt,
      endAt: b.endAt,
      label: b.label,
      discipline: b.discipline,
      groupId: b.groupId,
      groupName: b.group?.name ?? null,
      payAndTrainEnabled: b.payAndTrainEnabled,
      customerName: b.customerName,
      customerEmail: b.customerEmail,
      status: b.status,
      publicPrice: b.publicPrice,
      notes: b.notes,
    })),
  };
}

// Public-facing read: for the academy's `/book` page. Returns only the
// slots that are publicly bookable (payAndTrainEnabled=true) and not yet
// taken by an internal team OR by another customer.
export async function getPublicAvailability(academySlug: string, weekStart: Date) {
  const academy = await prisma.academy.findUnique({
    where: { slug: academySlug },
    select: { id: true, name: true, currency: true, sport: true, location: true },
  });
  if (!academy) return null;

  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const [slopes, openSlots, takenSlots] = await Promise.all([
    getSlopesWithLines(academy.id),
    prisma.lineBooking.findMany({
      where: {
        academyId: academy.id,
        startAt: { gte: start, lt: end },
        payAndTrainEnabled: true,
        groupId: null,                 // not held by an internal team
        OR: [{ status: "pending" }, { status: "confirmed" }],
        customerEmail: null,           // not yet bought by anyone
      },
      include: { line: { include: { slope: true } } },
      orderBy: [{ startAt: "asc" }],
    }),
    prisma.lineBooking.findMany({
      where: {
        academyId: academy.id,
        startAt: { gte: start, lt: end },
        OR: [
          { groupId: { not: null } },
          { customerEmail: { not: null } },
        ],
      },
      select: { lineId: true, startAt: true, endAt: true },
    }),
  ]);

  return {
    academy,
    slopes,
    weekStart: start,
    openSlots: openSlots.map((s) => ({
      id: s.id,
      lineId: s.lineId,
      lineLabel: s.line.label,
      slopeName: s.line.slope.name,
      startAt: s.startAt,
      endAt: s.endAt,
      price: s.publicPrice ?? 0,
      discipline: s.discipline,
    })),
    // Used to mark "internal" cells on the public preview so the visitor
    // sees the full grid + just can't buy the academy-team slots.
    takenSlots: takenSlots.map((s) => ({ lineId: s.lineId, startAt: s.startAt, endAt: s.endAt })),
  };
}

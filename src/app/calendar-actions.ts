"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession, requireAcademyId } from "@/lib/auth";
import { calendarEventSchema, firstError, type CalendarEventInput } from "@/lib/validation";

export type Result = { ok: boolean; error?: string; id?: string };

// Sum the breakdown — used when the coach doesn't override the estimate.
function sumBreakdown(d: CalendarEventInput): number {
  return (d.costHotel ?? 0) + (d.costFlights ?? 0) + (d.costVan ?? 0) + (d.costFuel ?? 0) +
         (d.costLiftPass ?? 0) + (d.costCoach ?? 0) + (d.costAccommodation ?? 0) +
         (d.costRaceFees ?? 0) + (d.costMisc ?? 0);
}
function eventDataFromInput(d: CalendarEventInput) {
  const breakdown = sumBreakdown(d);
  return {
    title: d.title,
    type: d.type,
    season: d.season,
    startDate: new Date(d.startDate),
    endDate: d.endDate ? new Date(d.endDate) : null,
    location: d.location ?? null,
    planBLocation: d.planBLocation ?? null,
    discipline: d.discipline ?? null,
    coachesNote: d.coachesNote ?? null,
    notes: d.notes ?? null,
    costHotel: d.costHotel ?? 0,
    costFlights: d.costFlights ?? 0,
    costVan: d.costVan ?? 0,
    costFuel: d.costFuel ?? 0,
    costLiftPass: d.costLiftPass ?? 0,
    costCoach: d.costCoach ?? 0,
    costAccommodation: d.costAccommodation ?? 0,
    costRaceFees: d.costRaceFees ?? 0,
    costMisc: d.costMisc ?? 0,
    estimatedCost: d.estimatedCost ?? (breakdown > 0 ? breakdown : null),
    actualCost: d.actualCost ?? null,
  };
}

function rev() {
  revalidatePath("/dashboard/calendar");
  revalidatePath("/me");
}

// Coaches can only manage events tied to their own groups (or that they organise).
// Academy admins can manage anything, including academy-wide events (groupId null).
async function canManage(s: { isAdmin: boolean; coachId: string | null }, academyId: string, groupId: string | null): Promise<{ ok: boolean; error?: string }> {
  if (s.isAdmin) return { ok: true };
  if (!s.coachId) return { ok: false, error: "Not authorised." };
  if (!groupId) return { ok: false, error: "Only an admin can create academy-wide events." };
  const g = await prisma.group.findFirst({ where: { id: groupId, academyId, coachId: s.coachId }, select: { id: true } });
  if (!g) return { ok: false, error: "You can only manage events for your own groups." };
  return { ok: true };
}

export async function createCalendarEvent(input: unknown): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();
  const parsed = calendarEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const guard = await canManage(s, academyId, d.groupId);
  if (!guard.ok) return guard;

  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } });
  const ev = await prisma.calendarEvent.create({
    data: {
      academyId,
      groupId: d.groupId,
      coachId: s.coachId ?? null,
      currency: academy?.currency ?? "EUR",
      createdById: s.userId,
      ...eventDataFromInput(d),
    },
  });
  rev();
  return { ok: true, id: ev.id };
}

export async function updateCalendarEvent(id: string, input: unknown): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();
  const parsed = calendarEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const existing = await prisma.calendarEvent.findFirst({ where: { id, academyId } });
  if (!existing) return { ok: false, error: "Event not found." };
  const guardOld = await canManage(s, academyId, existing.groupId);
  if (!guardOld.ok) return guardOld;
  const guardNew = await canManage(s, academyId, d.groupId);
  if (!guardNew.ok) return guardNew;

  await prisma.calendarEvent.update({
    where: { id },
    data: { groupId: d.groupId, ...eventDataFromInput(d) },
  });
  rev();
  return { ok: true, id };
}

export async function deleteCalendarEvent(id: string): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();
  const existing = await prisma.calendarEvent.findFirst({ where: { id, academyId } });
  if (!existing) return { ok: false, error: "Event not found." };
  const guard = await canManage(s, academyId, existing.groupId);
  if (!guard.ok) return guard;
  await prisma.calendarEvent.delete({ where: { id } });
  rev();
  return { ok: true };
}


// ─────────────────────────────────────────────────────────────────────────────
// Excel / CSV import — coach uploads a season-plan file, parser turns rows
// into CalendarEvent records, all in one click. Lives behind the same
// canManage() guard as manual create: a coach can only import into one of
// their own groups; an admin can target any group or push academy-wide.
// ─────────────────────────────────────────────────────────────────────────────
export type ImportResult =
  | { ok: true; created: number; skipped: number; warnings: string[]; sheetName: string }
  | { ok: false; error: string };

export async function importCalendarFromFile(formData: FormData): Promise<ImportResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file uploaded." };
  if (file.size === 0) return { ok: false, error: "File is empty." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "File too large (max 10MB)." };

  const rawGroupId = formData.get("groupId");
  const groupId = typeof rawGroupId === "string" && rawGroupId.length > 0 ? rawGroupId : null;

  // Tenant + role scope: coach can only target their own groups.
  const guard = await canManage(s, academyId, groupId);
  if (!guard.ok) return { ok: false, error: guard.error ?? "Not authorised." };

  // Coach can only target THEIR group; if no groupId, we use their first
  // assigned group rather than dropping into the academy-wide bucket
  // (which would surprise them — academy events show up everywhere).
  let effectiveGroupId = groupId;
  if (!effectiveGroupId && !s.isAdmin && s.coachId) {
    const ownGroup = await prisma.group.findFirst({
      where: { academyId, coachId: s.coachId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    effectiveGroupId = ownGroup?.id ?? null;
    if (!effectiveGroupId) return { ok: false, error: "You have no group assigned to import into." };
  }

  const { parseCalendarFile } = await import("@/lib/calendarImport");
  const buffer = await file.arrayBuffer();
  // Grid layouts (Marius's calendar-grid spreadsheet) have month names
  // but no year. Anchor them with the academy's active season — "2026/27"
  // means May 2026 is the first month, so seasonStartYear = 2026.
  const { getActiveSeason } = await import("@/lib/season-server");
  const season = await getActiveSeason();
  const seasonStartYear = parseInt(season.split("/")[0], 10);
  let parsed;
  try {
    parsed = parseCalendarFile(buffer, { seasonStartYear });
  } catch (err) {
    return { ok: false, error: `Could not read the file. Make sure it is a valid .xlsx or .csv. (${(err as Error).message})` };
  }

  if (parsed.events.length === 0) {
    return {
      ok: false,
      error: parsed.warnings[0] ?? "No events found in the file.",
    };
  }

  // Map parsed type → schema-default season string ("all"); the calendar
  // page filters by date, not by season label, so leaving "all" keeps
  // imported events visible regardless of the active season cookie.
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } });
  const currency = academy?.currency ?? "EUR";
  let created = 0;
  for (const ev of parsed.events) {
    await prisma.calendarEvent.create({
      data: {
        academyId,
        groupId: effectiveGroupId,
        coachId: s.coachId ?? null,
        title: ev.title,
        type: ev.type,
        season: "all",
        startDate: ev.startDate,
        endDate: ev.endDate ?? null,
        location: ev.location,
        notes: ev.notes,
        currency,
        createdById: s.userId,
      },
    });
    created++;
  }
  rev();
  return {
    ok: true,
    created,
    skipped: Math.max(0, parsed.totalRows - parsed.events.length),
    warnings: parsed.warnings,
    sheetName: parsed.sheetName,
  };
}

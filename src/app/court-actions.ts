"use server";

// LEAF OS Essential Tennis — facility + court + camp CRUD. Mirrors
// line-actions.ts (Slope/Line/LineBooking) one-to-one but tennis-shaped.

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { firstError } from "@/lib/validation";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

function rev() {
  revalidatePath("/dashboard/courts");
  revalidatePath("/dashboard/camps");
  revalidatePath("/dashboard/bookings");
}

// ── Facilities + Courts ────────────────────────────────────────────────
const facilitySchema = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().max(200).nullish().transform((v) => v ?? null),
  courtCount: z.coerce.number().int().min(1).max(50),
  surface: z.string().trim().max(20).nullish().transform((v) => v ?? "clay"),
  indoor: z.boolean().optional().transform((v) => v ?? false),
});

export async function createFacility(input: z.input<typeof facilitySchema>): Promise<Result<{ id: string }>> {
  const parsed = facilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const d = parsed.data;

  const facility = await prisma.tennisFacility.create({
    data: {
      academyId: s.academyId,
      name: d.name,
      address: d.address,
      courts: {
        create: Array.from({ length: d.courtCount }, (_, i) => ({
          academyId: s.academyId!,
          label: `Court ${i + 1}`,
          position: i + 1,
          surface: d.surface,
          indoor: d.indoor,
        })),
      },
    },
  });
  rev();
  return { ok: true, data: { id: facility.id } };
}

// ── Camps ──────────────────────────────────────────────────────────────
const campSchema = z.object({
  name: z.string().trim().min(1).max(120),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  ageMin: z.coerce.number().int().min(3).max(80).nullish(),
  ageMax: z.coerce.number().int().min(3).max(80).nullish(),
  level: z.string().trim().max(30).nullish().transform((v) => v ?? null),
  capacity: z.coerce.number().int().min(1).max(200),
  price: z.coerce.number().int().min(0),
  description: z.string().trim().max(800).nullish().transform((v) => v ?? null),
});

export async function createCamp(input: z.input<typeof campSchema>): Promise<Result<{ id: string }>> {
  const parsed = campSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const d = parsed.data;
  const academy = await prisma.academy.findUnique({ where: { id: s.academyId }, select: { currency: true } });

  const created = await prisma.tennisCamp.create({
    data: {
      academyId: s.academyId,
      name: d.name,
      startDate: new Date(d.startDate),
      endDate: new Date(d.endDate),
      ageMin: d.ageMin ?? null,
      ageMax: d.ageMax ?? null,
      level: d.level,
      capacity: d.capacity,
      price: d.price,
      currency: academy?.currency ?? "EUR",
      description: d.description,
    },
  });
  rev();
  return { ok: true, data: { id: created.id } };
}

export async function deleteCamp(id: string): Promise<Result> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const existing = await prisma.tennisCamp.findFirst({ where: { id, academyId: s.academyId } });
  if (!existing) return { ok: false, error: "Camp not found." };
  await prisma.tennisCamp.delete({ where: { id } });
  rev();
  return { ok: true };
}

// ── Court bookings (the weekly grid) ───────────────────────────────────────
const BK_TYPES = ["lesson", "course", "member", "maintenance"];

async function bookingConflicts(academyId: string, courtId: string, startAt: Date, endAt: Date, excludeId?: string) {
  const clash = await prisma.courtBooking.findFirst({
    where: { academyId, courtId, ...(excludeId ? { id: { not: excludeId } } : {}), startAt: { lt: endAt }, endAt: { gt: startAt } },
    select: { id: true },
  });
  return !!clash;
}

function dayBaseUTC(dateISO: string): number | null {
  const m = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export type CreateCourtBookingInput = {
  courtId: string; dateISO: string; startMin: number; endMin: number;
  type: string; title?: string; groupId?: string; repeatWeeks?: number;
};

export async function createCourtBooking(
  input: CreateCourtBookingInput,
): Promise<{ ok: boolean; error?: string; created?: number; skipped?: number }> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  if (!input.courtId || !(input.endMin > input.startMin)) return { ok: false, error: "Slot non valido." };
  const base0 = dayBaseUTC(input.dateISO);
  if (base0 == null) return { ok: false, error: "Data non valida." };
  const type = BK_TYPES.includes(input.type) ? input.type : "lesson";
  const repeats = Math.max(1, Math.min(52, Math.round(input.repeatWeeks ?? 1)));
  const seriesId = repeats > 1 ? randomUUID() : null;

  let created = 0, skipped = 0;
  for (let w = 0; w < repeats; w++) {
    const base = base0 + w * 7 * 86_400_000;
    const startAt = new Date(base + input.startMin * 60_000);
    const endAt = new Date(base + input.endMin * 60_000);
    if (await bookingConflicts(s.academyId, input.courtId, startAt, endAt)) { skipped++; continue; }
    await prisma.courtBooking.create({
      data: { academyId: s.academyId, courtId: input.courtId, groupId: input.groupId || null, startAt, endAt, discipline: type, label: input.title?.trim() || null, seriesId },
    });
    created++;
  }
  rev();
  if (created === 0) return { ok: false, error: "Slot già occupato." };
  return { ok: true, created, skipped };
}

// Move / resize a single booking (drag).
export async function moveCourtBooking(input: {
  id: string; courtId: string; dateISO: string; startMin: number; endMin: number;
}): Promise<{ ok: boolean; error?: string }> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  if (!(input.endMin > input.startMin)) return { ok: false, error: "Slot non valido." };
  const base = dayBaseUTC(input.dateISO);
  if (base == null) return { ok: false, error: "Data non valida." };
  const startAt = new Date(base + input.startMin * 60_000);
  const endAt = new Date(base + input.endMin * 60_000);
  if (await bookingConflicts(s.academyId, input.courtId, startAt, endAt, input.id)) return { ok: false, error: "Slot già occupato." };
  await prisma.courtBooking.updateMany({ where: { academyId: s.academyId, id: input.id }, data: { courtId: input.courtId, startAt, endAt } });
  rev();
  return { ok: true };
}

export async function deleteCourtBooking(id: string): Promise<{ ok: boolean }> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false };
  await prisma.courtBooking.deleteMany({ where: { academyId: s.academyId, id } });
  rev();
  return { ok: true };
}

export async function deleteCourtSeries(seriesId: string): Promise<{ ok: boolean; count?: number }> {
  const s = await requireAdmin();
  if (!s.academyId || !seriesId) return { ok: false };
  const r = await prisma.courtBooking.deleteMany({ where: { academyId: s.academyId, seriesId } });
  rev();
  return { ok: true, count: r.count };
}

// Public registration (no auth) — parent fills, system holds pending.
const regSchema = z.object({
  campId: z.string().min(1),
  parentName: z.string().trim().min(2).max(80),
  parentEmail: z.string().trim().toLowerCase().email().max(120),
  parentPhone: z.string().trim().max(40).nullish().transform((v) => v ?? null),
  childName: z.string().trim().min(2).max(80),
  childDob: z.string().min(1),
  childLevel: z.string().trim().max(30).nullish().transform((v) => v ?? null),
  notes: z.string().trim().max(500).nullish().transform((v) => v ?? null),
});

export async function registerForCamp(input: z.input<typeof regSchema>): Promise<Result<{ id: string }>> {
  const parsed = regSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const camp = await prisma.tennisCamp.findUnique({ where: { id: d.campId }, select: { id: true, capacity: true, active: true, registrations: { select: { id: true, status: true } } } });
  if (!camp) return { ok: false, error: "Camp not found." };
  if (!camp.active) return { ok: false, error: "This camp is not accepting registrations." };
  const confirmed = camp.registrations.filter((r) => r.status !== "cancelled").length;
  if (confirmed >= camp.capacity) return { ok: false, error: "Camp is full." };

  const created = await prisma.tennisCampRegistration.create({
    data: {
      campId: d.campId,
      parentName: d.parentName,
      parentEmail: d.parentEmail,
      parentPhone: d.parentPhone,
      childName: d.childName,
      childDob: new Date(d.childDob),
      childLevel: d.childLevel,
      notes: d.notes,
      status: "pending",
    },
  });
  rev();
  return { ok: true, data: { id: created.id } };
}

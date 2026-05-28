"use server";

// LEAF OS Essential Tennis — facility + court + camp CRUD. Mirrors
// line-actions.ts (Slope/Line/LineBooking) one-to-one but tennis-shaped.

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

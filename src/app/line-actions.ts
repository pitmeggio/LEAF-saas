"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { firstError } from "@/lib/validation";
import { parseTreningsskjema } from "@/lib/treningsskjemaParser";

// LEAF OS Essential — slope + line + booking CRUD.
//
// All mutations are admin-only and tenant-scoped: a coach can sign up
// for a booking through the public widget, but only the academy admin
// configures slopes/lines, prices and Pay-and-Train availability.

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

function rev() {
  revalidatePath("/dashboard/lines");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/sessions");
  revalidatePath("/dashboard/utilization");
}

// ── Slopes ────────────────────────────────────────────────────────────────
const slopeInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  facility: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  lineCount: z.coerce.number().int().min(1).max(20),
});

export async function createSlope(input: { name: string; facility?: string; lineCount: number }): Promise<Result<{ slopeId: string }>> {
  const parsed = slopeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const d = parsed.data;

  const slope = await prisma.trainingSlope.create({
    data: {
      academyId: s.academyId,
      name: d.name,
      facility: d.facility,
      lines: {
        // Auto-create N lines numbered 1..N. Admin can rename labels later.
        create: Array.from({ length: d.lineCount }, (_, i) => ({
          label: String(i + 1),
          position: i + 1,
        })),
      },
    },
  });
  rev();
  return { ok: true, data: { slopeId: slope.id } };
}

export async function deleteSlope(id: string): Promise<Result> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const slope = await prisma.trainingSlope.findFirst({ where: { id, academyId: s.academyId }, select: { id: true } });
  if (!slope) return { ok: false, error: "Slope not found." };
  await prisma.trainingSlope.delete({ where: { id } });
  rev();
  return { ok: true };
}

// ── Bookings ───────────────────────────────────────────────────────────────
const bookingInputSchema = z.object({
  lineId: z.string().min(1),
  startAt: z.string().min(1),               // ISO date-time
  endAt: z.string().min(1),
  groupId: z.string().nullish(),
  // .nullish() = string | null | undefined — the grid passes `null` for
  // empty fields, the form sends "", so accept both and normalise to null.
  label: z.string().trim().max(40).nullish().transform((v) => (v ? v : null)),
  discipline: z.string().trim().max(20).nullish().transform((v) => (v ? v : null)),
  notes: z.string().trim().max(1000).nullish().transform((v) => (v ? v : null)),
  payAndTrainEnabled: z.boolean().optional().transform((v) => v ?? false),
  publicPrice: z.coerce.number().int().min(0).nullish(),
});

export async function createLineBooking(input: z.input<typeof bookingInputSchema>): Promise<Result<{ id: string }>> {
  const parsed = bookingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const d = parsed.data;

  // Tenant ownership: the line must belong to this academy.
  const line = await prisma.trainingLine.findFirst({
    where: { id: d.lineId, slope: { academyId: s.academyId } },
    select: { id: true },
  });
  if (!line) return { ok: false, error: "Line not found in your academy." };

  const startAt = new Date(d.startAt);
  const endAt = new Date(d.endAt);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) {
    return { ok: false, error: "Invalid start/end date." };
  }
  if (endAt <= startAt) return { ok: false, error: "End must be after start." };

  // Conflict guard: don't double-book the same line in overlapping times.
  const conflict = await prisma.lineBooking.findFirst({
    where: {
      lineId: d.lineId,
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      status: { in: ["confirmed", "pending"] },
    },
    select: { id: true },
  });
  if (conflict) return { ok: false, error: "This line is already booked in that time window." };

  // Group ownership check when groupId is provided.
  if (d.groupId) {
    const g = await prisma.group.findFirst({ where: { id: d.groupId, academyId: s.academyId }, select: { id: true } });
    if (!g) return { ok: false, error: "Group not in your academy." };
  }

  const created = await prisma.lineBooking.create({
    data: {
      academyId: s.academyId,
      lineId: d.lineId,
      groupId: d.groupId ?? null,
      startAt,
      endAt,
      label: d.label,
      discipline: d.discipline,
      notes: d.notes,
      payAndTrainEnabled: d.payAndTrainEnabled,
      publicPrice: d.publicPrice ?? null,
      createdById: s.userId,
    },
  });
  rev();
  return { ok: true, data: { id: created.id } };
}

// Move a booking to a different (line, day, slot). Used by the admin
// drag-and-drop on the line schedule grid: Marius drags "TRA SL" from
// L4 to L2 and we rewrite lineId + startAt + endAt in one go. The new
// cell must be empty (no conflicting booking on that line in the same
// window) — we re-check inside a transaction so two simultaneous drags
// can't both succeed on the same target cell.
const moveSchema = z.object({
  bookingId: z.string().min(1),
  targetLineId: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
});

export async function moveLineBooking(input: z.input<typeof moveSchema>): Promise<Result> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const d = parsed.data;

  const startAt = new Date(d.startAt);
  const endAt = new Date(d.endAt);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) {
    return { ok: false, error: "Invalid start/end date." };
  }
  if (endAt <= startAt) return { ok: false, error: "End must be after start." };

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.lineBooking.findFirst({
      where: { id: d.bookingId, academyId: s.academyId! },
      select: { id: true, lineId: true, startAt: true, endAt: true },
    });
    if (!existing) return { ok: false as const, error: "Booking not found." };

    const targetLine = await tx.trainingLine.findFirst({
      where: { id: d.targetLineId, slope: { academyId: s.academyId! } },
      select: { id: true },
    });
    if (!targetLine) return { ok: false as const, error: "Target line not in your academy." };

    // No-op if the booking is already on the same (line, startAt).
    if (existing.lineId === d.targetLineId && existing.startAt.getTime() === startAt.getTime()) {
      return { ok: true as const };
    }

    const conflict = await tx.lineBooking.findFirst({
      where: {
        id: { not: d.bookingId },
        lineId: d.targetLineId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        status: { in: ["confirmed", "pending"] },
      },
      select: { id: true },
    });
    if (conflict) return { ok: false as const, error: "Target cell is already booked." };

    await tx.lineBooking.update({
      where: { id: d.bookingId },
      data: { lineId: d.targetLineId, startAt, endAt },
    });
    return { ok: true as const };
  });

  if (result.ok) rev();
  return result;
}

export async function deleteLineBooking(id: string): Promise<Result> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const existing = await prisma.lineBooking.findFirst({ where: { id, academyId: s.academyId } });
  if (!existing) return { ok: false, error: "Booking not found." };
  await prisma.lineBooking.delete({ where: { id } });
  rev();
  return { ok: true };
}

// Flip a booking's Pay-and-Train flag from the admin grid — when ON, the
// slot appears on the public /book widget at the given price.
const payAndTrainSchema = z.object({
  bookingId: z.string().min(1),
  payAndTrainEnabled: z.boolean(),
  publicPrice: z.coerce.number().int().min(0).optional(),
});

export async function togglePayAndTrain(input: z.infer<typeof payAndTrainSchema>): Promise<Result> {
  const parsed = payAndTrainSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };

  const existing = await prisma.lineBooking.findFirst({
    where: { id: parsed.data.bookingId, academyId: s.academyId },
    select: { id: true, groupId: true },
  });
  if (!existing) return { ok: false, error: "Slot not found." };
  // Don't allow flipping an internal team slot to public — it would
  // bump the team out of their training time.
  if (parsed.data.payAndTrainEnabled && existing.groupId) {
    return { ok: false, error: "This slot is held by an internal team. Cancel that booking before listing it publicly." };
  }
  await prisma.lineBooking.update({
    where: { id: parsed.data.bookingId },
    data: {
      payAndTrainEnabled: parsed.data.payAndTrainEnabled,
      publicPrice: parsed.data.publicPrice ?? null,
    },
  });
  rev();
  return { ok: true };
}

// ── Public booking flow (no auth) — used by /academy/[slug]/book ────────
const publicBookSchema = z.object({
  slotId: z.string().min(1),
  customerName: z.string().trim().min(2).max(80),
  customerEmail: z.string().trim().toLowerCase().email("Invalid email").max(120),
  customerPhone: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
});

// Public booking: customer claims a Pay-and-Train slot. The slot must
// already exist as a pre-created "open" lineBooking with
// payAndTrainEnabled=true, groupId=null, customerEmail=null. The action
// just attaches customer details and marks status="confirmed"; the
// "ledger" of buyable slots stays a single source of truth.
//
// Stripe is wired but optional — for the demo, we mark as "confirmed"
// with paidAmount=0 and the academy admin confirms reception manually.
export async function bookSlotPublicly(input: z.input<typeof publicBookSchema>): Promise<Result<{ bookingId: string }>> {
  const parsed = publicBookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  // Lock the slot in a transaction so two customers don't grab the same
  // slot at the same time. Race condition would be embarrassing on day 1.
  const result = await prisma.$transaction(async (tx) => {
    const slot = await tx.lineBooking.findUnique({
      where: { id: d.slotId },
      select: { id: true, payAndTrainEnabled: true, groupId: true, customerEmail: true, status: true },
    });
    if (!slot) return { ok: false as const, error: "Slot not found." };
    if (!slot.payAndTrainEnabled) return { ok: false as const, error: "This slot is not available for public booking." };
    if (slot.groupId) return { ok: false as const, error: "This slot is reserved for an internal team." };
    if (slot.customerEmail || slot.status === "cancelled") {
      return { ok: false as const, error: "This slot has already been booked." };
    }
    await tx.lineBooking.update({
      where: { id: d.slotId },
      data: {
        customerName: d.customerName,
        customerEmail: d.customerEmail,
        customerPhone: d.customerPhone,
        status: "confirmed",
      },
    });
    return { ok: true as const, data: { bookingId: slot.id } };
  });

  if (result.ok) {
    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/lines");
  }
  return result;
}

// ── Public line booking (external club coach) ────────────────────────────
// A visiting coach picks an empty cell on the public weekly grid and
// books that line for their own team's training. No pre-listing by the
// admin — any unbooked cell on a line that's not held by the academy or
// already grabbed by P&T is fair game.
const externalLineBookSchema = z.object({
  academySlug: z.string().min(1),
  lineId: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  coachName: z.string().trim().min(2).max(80),
  coachEmail: z.string().trim().toLowerCase().email("Invalid email").max(120),
  clubName: z.string().trim().min(2).max(100),
  coachPhone: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
  discipline: z.string().trim().max(20).optional().transform((v) => (v ? v : null)),
  notes: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
});

export async function bookLineByExternalCoach(input: z.input<typeof externalLineBookSchema>): Promise<Result<{ bookingId: string }>> {
  const parsed = externalLineBookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const startAt = new Date(d.startAt);
  const endAt = new Date(d.endAt);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) {
    return { ok: false, error: "Invalid start/end date." };
  }
  if (endAt <= startAt) return { ok: false, error: "End must be after start." };

  // Resolve the academy + verify the line belongs to it.
  const line = await prisma.trainingLine.findFirst({
    where: { id: d.lineId, slope: { academy: { slug: d.academySlug } } },
    select: { id: true, slope: { select: { academyId: true } } },
  });
  if (!line) return { ok: false, error: "Line not found at this academy." };

  // Lock-in-transaction: re-check conflicts under the same tx that writes.
  const result = await prisma.$transaction(async (tx) => {
    const conflict = await tx.lineBooking.findFirst({
      where: {
        lineId: d.lineId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        status: { in: ["confirmed", "pending"] },
      },
      select: { id: true },
    });
    if (conflict) return { ok: false as const, error: "This line is already booked for that time. Pick another cell." };
    const created = await tx.lineBooking.create({
      data: {
        academyId: line.slope.academyId,
        lineId: d.lineId,
        startAt,
        endAt,
        label: d.clubName.slice(0, 18).toUpperCase(),  // short chip on the admin grid
        discipline: d.discipline,
        notes: d.notes,
        customerName: d.coachName,
        customerEmail: d.coachEmail,
        customerPhone: d.coachPhone,
        bookerOrg: d.clubName,
        status: "confirmed",
      },
    });
    return { ok: true as const, data: { bookingId: created.id } };
  });

  if (result.ok) {
    revalidatePath("/dashboard/lines");
    revalidatePath("/dashboard/bookings");
  }
  return result;
}

// ── Treningsskjema Excel import ──────────────────────────────────────────
// Accept a Treningsskjema.xlsx upload + a year (the sheet doesn't carry one),
// auto-create any missing slopes/lines under this academy, then create one
// LineBooking per non-empty cell. Idempotent: rows with the exact same
// (lineId, startAt) already in the DB get skipped — re-importing the same
// week is safe.
const importSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2099),
  fileName: z.string().max(200).optional(),
});

export async function importTreningsskjema(form: FormData): Promise<Result<{
  created: number;
  skipped: number;
  weekNumber: number | null;
  warnings: string[];
  slopesCreated: number;
  linesCreated: number;
}>> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };

  const parsedInput = importSchema.safeParse({
    year: form.get("year"),
    fileName: form.get("fileName") ?? undefined,
  });
  if (!parsedInput.success) return { ok: false, error: firstError(parsedInput.error) };

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Missing file." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "File too large (max 2 MB)." };

  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  let parsed;
  try {
    parsed = parseTreningsskjema(buf, parsedInput.data.year);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not parse the Excel file." };
  }
  if (parsed.bookings.length === 0) {
    return {
      ok: false,
      error: parsed.warnings.join(" ") || "No bookings found in the file. Check that the sheet matches the Treningsskjema layout.",
    };
  }

  // Map slopeName → existing or freshly created TrainingSlope; lineLabel → TrainingLine.
  const slopeNames = Array.from(new Set(parsed.bookings.map((b) => b.slopeName)));
  let slopesCreated = 0;
  let linesCreated = 0;

  const slopeByName = new Map<string, { id: string; lines: Map<string, string> }>();
  for (const name of slopeNames) {
    let slope = await prisma.trainingSlope.findFirst({
      where: { academyId: s.academyId, name },
      include: { lines: true },
    });
    if (!slope) {
      slope = await prisma.trainingSlope.create({
        data: { academyId: s.academyId, name },
        include: { lines: true },
      });
      slopesCreated++;
    }
    const lineMap = new Map<string, string>();
    for (const l of slope.lines) lineMap.set(l.label, l.id);
    slopeByName.set(name, { id: slope.id, lines: lineMap });
  }

  // Auto-create any line labels that don't exist yet on each slope.
  for (const b of parsed.bookings) {
    const slope = slopeByName.get(b.slopeName);
    if (!slope) continue;
    if (slope.lines.has(b.lineLabel)) continue;
    const position = Number.isFinite(parseInt(b.lineLabel, 10)) ? parseInt(b.lineLabel, 10) : slope.lines.size + 1;
    const created = await prisma.trainingLine.create({
      data: { slopeId: slope.id, label: b.lineLabel, position },
    });
    slope.lines.set(b.lineLabel, created.id);
    linesCreated++;
  }

  // Insert bookings, skipping rows that already exist for the same (line, startAt).
  let created = 0;
  let skipped = 0;
  const weekLabel = parsed.weekNumber ? `imported:week-${parsed.weekNumber}` : "imported";

  for (const b of parsed.bookings) {
    const slope = slopeByName.get(b.slopeName);
    if (!slope) {
      skipped++;
      continue;
    }
    const lineId = slope.lines.get(b.lineLabel);
    if (!lineId) {
      skipped++;
      continue;
    }
    const exists = await prisma.lineBooking.findFirst({
      where: { lineId, startAt: b.startAt },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }
    await prisma.lineBooking.create({
      data: {
        academyId: s.academyId,
        lineId,
        startAt: b.startAt,
        endAt: b.endAt,
        label: b.label,
        notes: weekLabel,
        createdById: s.userId,
      },
    });
    created++;
  }

  rev();
  return {
    ok: true,
    data: {
      created,
      skipped,
      weekNumber: parsed.weekNumber,
      warnings: parsed.warnings,
      slopesCreated,
      linesCreated,
    },
  };
}

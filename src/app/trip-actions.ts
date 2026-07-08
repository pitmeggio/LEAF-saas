"use server";

// Trasferte actions. Any academy staff (admin / office / coach) can create a
// trip, add members (roster athletes OR external players not in the rosters),
// and log shared expenses. Every write is tenant-scoped: the trip must belong
// to the staff member's academy before members/expenses touch it.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { firstError } from "@/lib/validation";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function requireStaff(): Promise<{ academyId: string; userId: string } | null> {
  const s = await getSession();
  if (!s || !s.academyId) return null;
  if (!(s.isAdmin || s.isOffice || s.isCoach)) return null;
  return { academyId: s.academyId, userId: s.userId };
}

// The trip must belong to the caller's academy.
async function ownsTrip(academyId: string, tripId: string): Promise<boolean> {
  const t = await prisma.trip.findFirst({ where: { id: tripId, academyId }, select: { id: true } });
  return !!t;
}

// ── Trip ───────────────────────────────────────────────────────────────────
const optDate = z.string().trim().nullish().transform((v) => (v && v.length ? v : null));
const tripSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome alla trasferta.").max(80),
  location: z.string().trim().max(120).nullish().transform((v) => v || null),
  zone: z.string().trim().max(60).nullish().transform((v) => v || null),
  startDate: z.string().min(1, "Indica la data di inizio."),
  endDate: optDate,
  notes: z.string().trim().max(1000).nullish().transform((v) => v || null),
});

export async function createTrip(input: z.input<typeof tripSchema>): Promise<Result<{ id: string }>> {
  const s = await requireStaff();
  if (!s) return { ok: false, error: "Non autorizzato." };
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  try {
    const t = await prisma.trip.create({
      data: {
        academyId: s.academyId, name: d.name, location: d.location, zone: d.zone,
        startDate: new Date(d.startDate), endDate: d.endDate ? new Date(d.endDate) : null,
        notes: d.notes, createdById: s.userId,
      },
      select: { id: true },
    });
    revalidatePath("/dashboard/trips");
    return { ok: true, data: { id: t.id } };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2021") return { ok: false, error: "Modulo Trasferte non ancora attivato sul database." };
    throw e;
  }
}

export async function deleteTrip(id: string): Promise<Result> {
  const s = await requireStaff();
  if (!s) return { ok: false, error: "Non autorizzato." };
  if (!(await ownsTrip(s.academyId, id))) return { ok: false, error: "Trasferta non trovata." };
  await prisma.trip.delete({ where: { id } });
  revalidatePath("/dashboard/trips");
  return { ok: true };
}

// ── Members ──────────────────────────────────────────────────────────────
const memberSchema = z.object({
  tripId: z.string().min(1),
  athleteId: z.string().trim().nullish().transform((v) => v || null),
  name: z.string().trim().max(80).nullish().transform((v) => v?.trim() || null),
  role: z.enum(["player", "coach"]).default("player"),
  external: z.coerce.boolean().optional().transform((v) => v ?? false),
});

export async function addTripMember(input: z.input<typeof memberSchema>): Promise<Result> {
  const s = await requireStaff();
  if (!s) return { ok: false, error: "Non autorizzato." };
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  if (!(await ownsTrip(s.academyId, d.tripId))) return { ok: false, error: "Trasferta non trovata." };

  let name = d.name;
  // Roster athlete → resolve the display name (and confirm they're in this academy).
  if (d.athleteId) {
    const ath = await prisma.athlete.findFirst({
      where: { id: d.athleteId, OR: [{ tennisSeasonPlans: { some: { academyId: s.academyId } } }, { enrollments: { some: { academyId: s.academyId } } }] },
      select: { firstName: true, lastName: true },
    });
    if (!ath) return { ok: false, error: "Atleta non in rosa." };
    name = `${ath.firstName} ${ath.lastName}`.trim();
  }
  if (!name) return { ok: false, error: "Indica il nome del partecipante." };

  await prisma.tripMember.create({
    data: { tripId: d.tripId, athleteId: d.athleteId, name, role: d.role, external: d.athleteId ? false : d.external },
  });
  revalidatePath(`/dashboard/trips/${d.tripId}`);
  return { ok: true };
}

export async function removeTripMember(id: string): Promise<Result> {
  const s = await requireStaff();
  if (!s) return { ok: false, error: "Non autorizzato." };
  const m = await prisma.tripMember.findUnique({ where: { id }, select: { tripId: true, trip: { select: { academyId: true } } } });
  if (!m || m.trip.academyId !== s.academyId) return { ok: false, error: "Partecipante non trovato." };
  await prisma.tripMember.delete({ where: { id } });
  revalidatePath(`/dashboard/trips/${m.tripId}`);
  return { ok: true };
}

// ── Expenses ─────────────────────────────────────────────────────────────
const expenseSchema = z.object({
  tripId: z.string().min(1),
  label: z.string().trim().min(1, "Descrivi la spesa.").max(80),
  category: z.enum(["travel", "hotel", "meals", "entry", "misc"]).default("misc"),
  amount: z.coerce.number().int().min(1, "Importo non valido.").max(1_000_000),
  paidById: z.string().trim().nullish().transform((v) => v || null),
  date: optDate,
});

export async function addTripExpense(input: z.input<typeof expenseSchema>): Promise<Result> {
  const s = await requireStaff();
  if (!s) return { ok: false, error: "Non autorizzato." };
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  if (!(await ownsTrip(s.academyId, d.tripId))) return { ok: false, error: "Trasferta non trovata." };

  // If a payer is given, it must be a member of THIS trip.
  if (d.paidById) {
    const mem = await prisma.tripMember.findFirst({ where: { id: d.paidById, tripId: d.tripId }, select: { id: true } });
    if (!mem) return { ok: false, error: "Chi ha pagato non è tra i partecipanti." };
  }

  await prisma.tripExpense.create({
    data: { tripId: d.tripId, label: d.label, category: d.category, amount: d.amount, paidById: d.paidById, date: d.date ? new Date(d.date) : null },
  });
  revalidatePath(`/dashboard/trips/${d.tripId}`);
  return { ok: true };
}

export async function removeTripExpense(id: string): Promise<Result> {
  const s = await requireStaff();
  if (!s) return { ok: false, error: "Non autorizzato." };
  const e = await prisma.tripExpense.findUnique({ where: { id }, select: { tripId: true, trip: { select: { academyId: true } } } });
  if (!e || e.trip.academyId !== s.academyId) return { ok: false, error: "Spesa non trovata." };
  await prisma.tripExpense.delete({ where: { id } });
  revalidatePath(`/dashboard/trips/${e.tripId}`);
  return { ok: true };
}

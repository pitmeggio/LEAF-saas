"use server";

import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  coachInputSchema, groupInputSchema, packageInputSchema,
  manualAthleteSchema, athleteUpdateSchema, applicationUpdateSchema,
  firstError, type CoachInput, type GroupInput, type PackageInput, type ManualAthleteInput,
} from "@/lib/validation";
import { resolveRequiredDocs, buildPaymentSchedule } from "@/lib/enrollmentLogic";
import { createInvoiceForPayment } from "@/lib/invoices";

export type Result = { ok: boolean; error?: string; id?: string };

function revalidateAll() {
  for (const p of ["/", "/members", "/groups", "/coaches", "/packages", "/payments", "/documents", "/alerts", "/reports", "/applications"]) {
    revalidatePath(p);
  }
}

// ── Coaches ──
export async function createCoach(input: CoachInput): Promise<Result> {
  const parsed = coachInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const academyId = await requireAcademyId();
  const c = await prisma.coach.create({ data: { ...parsed.data, academyId } });
  revalidateAll();
  return { ok: true, id: c.id };
}

export async function updateCoach(id: string, input: CoachInput): Promise<Result> {
  const parsed = coachInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const academyId = await requireAcademyId();
  const existing = await prisma.coach.findFirst({ where: { id, academyId } });
  if (!existing) return { ok: false, error: "Not found" };
  await prisma.coach.update({ where: { id }, data: parsed.data });
  revalidateAll();
  return { ok: true };
}

export async function archiveCoach(id: string): Promise<Result> {
  const academyId = await requireAcademyId();
  const c = await prisma.coach.findFirst({ where: { id, academyId } });
  if (!c) return { ok: false, error: "Not found" };
  await prisma.coach.update({ where: { id }, data: { active: !c.active } });
  revalidateAll();
  return { ok: true };
}

export async function deleteCoach(id: string): Promise<Result> {
  const academyId = await requireAcademyId();
  const c = await prisma.coach.findFirst({ where: { id, academyId } });
  if (!c) return { ok: false, error: "Not found" };
  // Detach references first (groups + enrollments), then delete.
  await prisma.group.updateMany({ where: { coachId: id }, data: { coachId: null } });
  await prisma.enrollment.updateMany({ where: { coachId: id }, data: { coachId: null } });
  await prisma.coach.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

// ── Groups ──
export async function createGroup(input: GroupInput): Promise<Result> {
  const parsed = groupInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const academyId = await requireAcademyId();
  if (parsed.data.coachId) {
    const exists = await prisma.coach.findFirst({ where: { id: parsed.data.coachId, academyId } });
    if (!exists) return { ok: false, error: "Invalid coach" };
  }
  const g = await prisma.group.create({ data: { ...parsed.data, academyId } });
  revalidateAll();
  return { ok: true, id: g.id };
}

export async function updateGroup(id: string, input: GroupInput): Promise<Result> {
  const parsed = groupInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const academyId = await requireAcademyId();
  const existing = await prisma.group.findFirst({ where: { id, academyId } });
  if (!existing) return { ok: false, error: "Not found" };
  await prisma.group.update({ where: { id }, data: parsed.data });
  revalidateAll();
  return { ok: true };
}

export async function deleteGroup(id: string): Promise<Result> {
  const academyId = await requireAcademyId();
  const g = await prisma.group.findFirst({ where: { id, academyId } });
  if (!g) return { ok: false, error: "Not found" };
  await prisma.enrollment.updateMany({ where: { groupId: id }, data: { groupId: null } });
  await prisma.group.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

// The academy's national currency — packages/payments are always priced in it.
async function academyCurrency(academyId: string): Promise<string> {
  const a = await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } });
  return a?.currency ?? "EUR";
}

// ── Packages ──
export async function createPackage(input: PackageInput): Promise<Result> {
  const parsed = packageInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const academyId = await requireAcademyId();
  const currency = await academyCurrency(academyId);
  const count = await prisma.package.count({ where: { academyId } });
  // Packages are the academy's own pricing → always in its national currency.
  const p = await prisma.package.create({ data: { ...parsed.data, currency, academyId, order: count + 1 } });
  revalidateAll();
  return { ok: true, id: p.id };
}

export async function updatePackage(id: string, input: PackageInput): Promise<Result> {
  const parsed = packageInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const academyId = await requireAcademyId();
  const existing = await prisma.package.findFirst({ where: { id, academyId } });
  if (!existing) return { ok: false, error: "Not found" };
  const currency = await academyCurrency(academyId);
  await prisma.package.update({ where: { id }, data: { ...parsed.data, currency } });
  revalidateAll();
  return { ok: true };
}

export async function deletePackage(id: string): Promise<Result> {
  const academyId = await requireAcademyId();
  const p = await prisma.package.findFirst({ where: { id, academyId } });
  if (!p) return { ok: false, error: "Not found" };
  await prisma.enrollment.updateMany({ where: { packageId: id }, data: { packageId: null } });
  await prisma.application.updateMany({ where: { packageId: id }, data: { packageId: null } });
  await prisma.package.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

// ── Manual athlete + enrollment ──
export async function createAthlete(input: ManualAthleteInput): Promise<Result> {
  const parsed = manualAthleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const academyId = await requireAcademyId();

  const athlete = await prisma.athlete.create({
    data: {
      firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone,
      dob: new Date(d.dob), nationality: d.nationality, gender: d.gender,
      sport: d.sport, discipline: d.discipline, verified: false,
      fisPoints: null, worldRank: null,
      photoColor: "#38bdf8", location: d.nationality,
    },
  });

  const joinDate = new Date();
  const enrollment = await prisma.enrollment.create({
    data: {
      academyId, athleteId: athlete.id, status: "active", joinDate,
      level: d.level, groupId: d.groupId, coachId: d.coachId, packageId: d.packageId,
    },
  });
  await prisma.enrollmentEvent.create({ data: { enrollmentId: enrollment.id, type: "created", to: "active", detail: "Manually added by academy admin" } });

  // Auto-create payment schedule + required documents (same automation as acceptance).
  if (d.packageId) {
    const pkg = await prisma.package.findFirst({ where: { id: d.packageId, academyId } });
    if (pkg?.price) {
      for (const p of buildPaymentSchedule({ price: pkg.price, currency: pkg.currency, billingFreq: pkg.billingFreq, joinDate })) {
        const payment = await prisma.payment.create({ data: { academyId, enrollmentId: enrollment.id, label: p.label, amount: p.amount, currency: p.currency, dueDate: p.dueDate, status: "unpaid" } });
        await createInvoiceForPayment(payment);
      }
    }
  }
  const docAcademy = await prisma.academy.findUnique({ where: { id: academyId }, select: { requiredDocs: true } });
  for (const type of resolveRequiredDocs(docAcademy?.requiredDocs)) {
    await prisma.document.create({ data: { academyId, enrollmentId: enrollment.id, type, status: "missing", required: true } });
  }

  revalidateAll();
  return { ok: true, id: enrollment.id };
}

export async function updateAthlete(input: unknown): Promise<Result> {
  const parsed = athleteUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const academyId = await requireAcademyId();
  // Ensure the athlete is enrolled at this academy (tenant guard).
  const enr = await prisma.enrollment.findFirst({ where: { athleteId: d.athleteId, academyId } });
  if (!enr) return { ok: false, error: "Not found" };
  await prisma.athlete.update({
    where: { id: d.athleteId },
    data: {
      firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone,
      nationality: d.nationality, discipline: d.discipline,
      emergencyContact: d.emergencyContact, guardianName: d.guardianName, guardianContact: d.guardianContact,
      // Tennis profile — pass-through; null for ski athletes never touches them.
      dominantHand: d.dominantHand,
      playingStyle: d.playingStyle,
      technicalLevel: d.technicalLevel,
      tacticalLevel: d.tacticalLevel,
      physicalLevel: d.physicalLevel,
      mentalLevel: d.mentalLevel,
      developmentGoals: d.developmentGoals,
    },
  });
  revalidatePath(`/members`);
  revalidateAll();
  return { ok: true };
}

// Remove an athlete from the academy (delete enrollment + its payments/docs/events).
export async function deleteEnrollment(enrollmentId: string): Promise<Result> {
  const academyId = await requireAcademyId();
  const e = await prisma.enrollment.findFirst({ where: { id: enrollmentId, academyId } });
  if (!e) return { ok: false, error: "Not found" };
  await prisma.payment.deleteMany({ where: { enrollmentId } });
  await prisma.document.deleteMany({ where: { enrollmentId } });
  await prisma.enrollmentEvent.deleteMany({ where: { enrollmentId } });
  await prisma.enrollment.delete({ where: { id: enrollmentId } });
  revalidateAll();
  return { ok: true };
}

// ── Applications ──
export async function updateApplication(input: unknown): Promise<Result> {
  const parsed = applicationUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const academyId = await requireAcademyId();
  const app = await prisma.application.findFirst({ where: { id: d.applicationId, academyId } });
  if (!app) return { ok: false, error: "Not found" };
  await prisma.application.update({
    where: { id: app.id },
    data: { programId: d.programId, packageId: d.packageId, score: d.score, message: d.message ?? undefined },
  });
  revalidatePath(`/applications/${app.id}`);
  revalidateAll();
  return { ok: true };
}

export async function deleteApplication(applicationId: string): Promise<Result> {
  const academyId = await requireAcademyId();
  const app = await prisma.application.findFirst({ where: { id: applicationId, academyId }, include: { enrollment: true } });
  if (!app) return { ok: false, error: "Not found" };
  // Detach enrollment link if any, then remove notes + status events, then the application.
  if (app.enrollment) await prisma.enrollment.update({ where: { id: app.enrollment.id }, data: { applicationId: null } });
  await prisma.note.deleteMany({ where: { applicationId } });
  await prisma.statusEvent.deleteMany({ where: { applicationId } });
  await prisma.application.delete({ where: { id: applicationId } });
  revalidateAll();
  return { ok: true };
}

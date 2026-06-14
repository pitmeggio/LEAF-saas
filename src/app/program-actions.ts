"use server";

import { prisma } from "@/lib/db";
import { getSession, requireAcademyId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { LineupRow } from "@/lib/trainingProgram";

export type Result = { ok: boolean; error?: string; id?: string };

export type ProgramInput = {
  kind: "training" | "race";
  title?: string;
  place?: string;
  discipline?: string;
  date: string; // YYYY-MM-DD
  groupId?: string;
  fields: Record<string, string>;
  lineup: LineupRow[];
};

function clean(input: ProgramInput) {
  return {
    kind: input.kind === "race" ? "race" : "training",
    title: input.title?.trim() || null,
    place: input.place?.trim() || null,
    discipline: input.discipline?.trim() || null,
    date: new Date(input.date),
    groupId: input.groupId || null,
    fields: input.fields ?? {},
    lineup: Array.isArray(input.lineup) ? input.lineup : [],
  };
}

// A coach owns a programme for one of their groups; an admin can target any
// group in the academy. Returns the group's name (denormalised) too.
async function assertGroup(academyId: string, groupId: string | null, isAdmin: boolean, coachId: string | null) {
  if (!groupId) return;
  const g = await prisma.group.findFirst({
    where: { id: groupId, academyId, ...(isAdmin ? {} : { coachId: coachId ?? "__none__" }) },
    select: { id: true },
  });
  if (!g) throw new Error("Group not found or not yours");
}

export async function createProgram(input: ProgramInput): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();
  if (!input.date) return { ok: false, error: "Pick a date" };
  const d = clean(input);
  try {
    await assertGroup(academyId, d.groupId, s.isAdmin ?? false, s.coachId);
  } catch {
    return { ok: false, error: "You can only program your own groups" };
  }
  const p = await prisma.trainingProgram.create({
    data: {
      academyId, coachId: s.coachId ?? null, coachName: s.name ?? null,
      kind: d.kind, title: d.title, place: d.place, discipline: d.discipline,
      date: d.date, groupId: d.groupId, status: "draft", fields: d.fields, lineup: d.lineup,
    },
    select: { id: true },
  });
  revalidatePath("/dashboard/programs");
  return { ok: true, id: p.id };
}

export async function updateProgram(id: string, input: ProgramInput): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();
  const existing = await prisma.trainingProgram.findFirst({ where: { id, academyId }, select: { id: true, coachId: true } });
  if (!existing) return { ok: false, error: "Not found" };
  if (!s.isAdmin && existing.coachId !== s.coachId) return { ok: false, error: "Not your programme" };
  const d = clean(input);
  try {
    await assertGroup(academyId, d.groupId, s.isAdmin ?? false, s.coachId);
  } catch {
    return { ok: false, error: "You can only program your own groups" };
  }
  await prisma.trainingProgram.update({
    where: { id },
    data: { kind: d.kind, title: d.title, place: d.place, discipline: d.discipline, date: d.date, groupId: d.groupId, fields: d.fields, lineup: d.lineup },
  });
  revalidatePath("/dashboard/programs");
  return { ok: true, id };
}

// Publish → athletes in the target group see it in the LEAF APP (pop).
export async function publishProgram(id: string): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();
  const p = await prisma.trainingProgram.findFirst({ where: { id, academyId }, select: { id: true, coachId: true } });
  if (!p) return { ok: false, error: "Not found" };
  if (!s.isAdmin && p.coachId !== s.coachId) return { ok: false, error: "Not your programme" };
  await prisma.trainingProgram.update({ where: { id }, data: { status: "published", publishedAt: new Date() } });
  revalidatePath("/dashboard/programs");
  return { ok: true, id };
}

export async function unpublishProgram(id: string): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();
  const p = await prisma.trainingProgram.findFirst({ where: { id, academyId }, select: { id: true, coachId: true } });
  if (!p) return { ok: false, error: "Not found" };
  if (!s.isAdmin && p.coachId !== s.coachId) return { ok: false, error: "Not your programme" };
  await prisma.trainingProgram.update({ where: { id }, data: { status: "draft", publishedAt: null } });
  revalidatePath("/dashboard/programs");
  return { ok: true, id };
}

export async function deleteProgram(id: string): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Not signed in" };
  const academyId = await requireAcademyId();
  const p = await prisma.trainingProgram.findFirst({ where: { id, academyId }, select: { id: true, coachId: true } });
  if (!p) return { ok: false, error: "Not found" };
  if (!s.isAdmin && p.coachId !== s.coachId) return { ok: false, error: "Not your programme" };
  await prisma.trainingProgram.delete({ where: { id } });
  revalidatePath("/dashboard/programs");
  return { ok: true };
}

import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import type { LineupRow } from "@/lib/trainingProgram";

// ── OS (coach/admin) ───────────────────────────────────────────────────────
// Coach sees programmes for their own groups; admin sees all in the academy.
export async function getProgramsForOps(coachId: string | null) {
  const academyId = await requireAcademyId();
  let groupFilter = {};
  if (coachId) {
    const groups = await prisma.group.findMany({ where: { academyId, coachId }, select: { id: true } });
    groupFilter = { groupId: { in: groups.map((g) => g.id) } };
  }
  const rows = await prisma.trainingProgram.findMany({
    where: { academyId, ...groupFilter },
    orderBy: [{ date: "desc" }],
  });
  const groupNames = await groupNameMap(academyId);
  return rows.map((p) => ({ ...p, groupName: p.groupId ? groupNames.get(p.groupId) ?? null : null }));
}

export async function getProgram(id: string) {
  const academyId = await requireAcademyId();
  const p = await prisma.trainingProgram.findFirst({ where: { id, academyId } });
  if (!p) return null;
  const groupNames = await groupNameMap(academyId);
  return { ...p, groupName: p.groupId ? groupNames.get(p.groupId) ?? null : null };
}

async function groupNameMap(academyId: string) {
  const groups = await prisma.group.findMany({ where: { academyId }, select: { id: true, name: true } });
  return new Map(groups.map((g) => [g.id, g.name]));
}

// The groups an athlete belongs to (active/accepted enrollments).
async function athleteGroupIds(athleteId: string): Promise<string[]> {
  const enr = await prisma.enrollment.findMany({
    where: { athleteId, status: { in: ["active", "accepted", "injured", "paused"] }, groupId: { not: null } },
    select: { groupId: true },
  });
  return enr.map((e) => e.groupId!).filter(Boolean);
}

// ── APP (athlete) ──────────────────────────────────────────────────────────
// All published programmes for the athlete's group(s), newest first.
export async function getAthletePrograms(athleteId: string) {
  const groupIds = await athleteGroupIds(athleteId);
  if (groupIds.length === 0) return [];
  return prisma.trainingProgram.findMany({
    where: { groupId: { in: groupIds }, status: "published" },
    orderBy: [{ date: "desc" }],
  });
}

// The single most-recently-published programme — drives the home pop.
export async function getLatestPublishedProgram(athleteId: string) {
  const groupIds = await athleteGroupIds(athleteId);
  if (groupIds.length === 0) return null;
  return prisma.trainingProgram.findFirst({
    where: { groupId: { in: groupIds }, status: "published" },
    orderBy: [{ publishedAt: "desc" }],
  });
}

// One published programme the athlete is allowed to see (in their group).
export async function getAthleteProgram(id: string, athleteId: string) {
  const groupIds = await athleteGroupIds(athleteId);
  const p = await prisma.trainingProgram.findFirst({
    where: { id, status: "published", groupId: { in: groupIds.length ? groupIds : ["__none__"] } },
  });
  return p;
}

// Pull this athlete's own line (bib + goals) out of the lineup JSON.
export function myLineupRow(lineup: unknown, athleteId: string): LineupRow | null {
  if (!Array.isArray(lineup)) return null;
  return (lineup as LineupRow[]).find((r) => r && r.athleteId === athleteId) ?? null;
}

import { prisma } from "@/lib/db";
import { trendFromPoints, type Trend } from "@/lib/domain";
import { getActiveAcademy, requireAcademyId } from "@/lib/auth";

export async function getAcademy() {
  return getActiveAcademy();
}

// Public (no auth) — used by the public academy page + application form.
export async function getPublicAcademy(slug: string) {
  return prisma.academy.findUnique({
    where: { slug },
    include: {
      programs: { orderBy: { name: "asc" } },
      packages: { orderBy: { order: "asc" } },
      _count: { select: { applications: true, programs: true } },
    },
  });
}

export function computeTrend(rankings: { date: Date; fisPoints: number }[]): Trend {
  if (rankings.length < 2) return { deltaPoints: 0, pct: 0, direction: "flat" };
  const sorted = [...rankings].sort((a, b) => +a.date - +b.date);
  return trendFromPoints(sorted[0].fisPoints, sorted[sorted.length - 1].fisPoints);
}

export type AthleteWithTrend = Awaited<ReturnType<typeof getAthletes>>[number];

export async function getAthletes() {
  const athletes = await prisma.athlete.findMany({
    include: { rankings: { orderBy: { date: "asc" } }, applications: true },
    orderBy: { fisPoints: "asc" },
  });
  return athletes.map((a) => ({ ...a, trend: computeTrend(a.rankings) }));
}

export async function getAthlete(id: string) {
  const a = await prisma.athlete.findUnique({
    where: { id },
    include: {
      rankings: { orderBy: { date: "asc" } },
      results: { orderBy: { date: "desc" } },
      media: true,
      applications: { include: { program: true } },
    },
  });
  if (!a) return null;
  return { ...a, trend: computeTrend(a.rankings) };
}

export type ApplicationRow = Awaited<ReturnType<typeof getApplications>>[number];

export async function getApplications() {
  const academyId = await requireAcademyId();
  const apps = await prisma.application.findMany({
    where: { academyId },
    include: {
      athlete: { include: { rankings: { orderBy: { date: "asc" } } } },
      program: true,
    },
    orderBy: { submittedAt: "desc" },
  });
  return apps.map((app) => ({ ...app, trend: computeTrend(app.athlete.rankings) }));
}

export async function getApplication(id: string) {
  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      athlete: {
        include: {
          rankings: { orderBy: { date: "asc" } },
          results: { orderBy: { date: "desc" }, take: 5 },
          media: true,
        },
      },
      program: true,
      package: true,
      academy: true,
      conversation: { select: { id: true } },
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!app) return null;
  return { ...app, trend: computeTrend(app.athlete.rankings) };
}

export async function getOverviewStats() {
  const apps = await getApplications();
  const byStatus = (s: string) => apps.filter((a) => a.status === s).length;
  const decided = apps.filter((a) => ["accepted", "rejected"].includes(a.status));
  const accepted = byStatus("accepted");
  const acceptanceRate = decided.length ? Math.round((accepted / decided.length) * 100) : 0;
  const improving = apps.filter((a) => a.trend.direction === "up").length;
  const avgScore = apps.length
    ? Math.round(apps.reduce((s, a) => s + (a.score ?? 0), 0) / apps.length)
    : 0;
  return {
    total: apps.length,
    new: byStatus("new"),
    reviewing: byStatus("reviewing"),
    accepted,
    shortlisted: byStatus("shortlisted"),
    rejected: byStatus("rejected"),
    acceptanceRate,
    improving,
    avgScore,
    apps,
  };
}

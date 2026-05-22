import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

export type AcademyWithMetrics = {
  id: string;
  name: string;
  slug: string;
  country: string;
  location: string | null;
  logoColor: string;
  status: string;
  plan: string;
  tagline: string | null;
  description: string | null;
  contactEmail: string | null;
  featureRecruiting: boolean;
  featurePublicProfiles: boolean;
  featureFinance: boolean;
  featureChat: boolean;
  maxAthletes: number | null;
  requiredDocs: string | null;
  createdAt: Date;
  metrics: {
    users: number;
    athletes: number; // enrolled athletes (active membership records)
    applications: number;
    coaches: number; // active coaches
  };
};

// Platform-wide listing for the Super Admin portal. NOT tenant-scoped — guarded by
// requireSuperAdmin() so only platform owners can read across academies.
export async function getAcademiesWithMetrics(): Promise<AcademyWithMetrics[]> {
  await requireSuperAdmin();

  const academies = await prisma.academy.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          users: true,
          enrollments: true,
          applications: true,
          coaches: { where: { active: true } },
        },
      },
    },
  });

  return academies.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    country: a.country,
    location: a.location,
    logoColor: a.logoColor,
    status: a.status,
    plan: a.plan,
    tagline: a.tagline,
    description: a.description,
    contactEmail: a.contactEmail,
    featureRecruiting: a.featureRecruiting,
    featurePublicProfiles: a.featurePublicProfiles,
    featureFinance: a.featureFinance,
    featureChat: a.featureChat,
    maxAthletes: a.maxAthletes,
    requiredDocs: a.requiredDocs,
    createdAt: a.createdAt,
    metrics: {
      users: a._count.users,
      athletes: a._count.enrollments,
      applications: a._count.applications,
      coaches: a._count.coaches,
    },
  }));
}

export async function getPlatformTotals() {
  await requireSuperAdmin();
  const [academies, active, users, athletes] = await Promise.all([
    prisma.academy.count(),
    prisma.academy.count({ where: { status: "active" } }),
    prisma.user.count(),
    prisma.enrollment.count(),
  ]);
  return { academies, active, users, athletes };
}

export type PlatformUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  academyId: string | null;
  academyName: string | null;
  hasPassword: boolean;
  createdAt: Date;
};

// Platform-wide account directory for the super-admin People page.
export async function getPlatformUsers(): Promise<PlatformUser[]> {
  await requireSuperAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { academy: { select: { name: true } } },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    academyId: u.academyId,
    academyName: u.academy?.name ?? null,
    hasPassword: !!u.passwordHash,
    createdAt: u.createdAt,
  }));
}

// Lightweight academy options for assigning users (no metrics needed).
export async function getAcademyOptions(): Promise<{ id: string; name: string }[]> {
  await requireSuperAdmin();
  return prisma.academy.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

// Onboarding requests for the review queue (pending first, then most recent).
export async function getAcademyRequests() {
  await requireSuperAdmin();
  return prisma.academyRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getPendingRequestCount(): Promise<number> {
  await requireSuperAdmin();
  return prisma.academyRequest.count({ where: { status: "pending" } });
}

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

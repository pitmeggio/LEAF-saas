import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readSessionToken } from "@/lib/password";

export const SESSION_COOKIE = "academy_uid";

// ── Roles & plans ───────────────────────────────────────────────────────────
// Single source of truth for the role/plan strings stored on User.role / Academy.plan.
export const ROLE = {
  SUPER_ADMIN: "super_admin", // platform owner — no academyId, bypasses tenant scoping
  ACADEMY_ADMIN: "academy_admin",
  COACH: "coach",
  ATHLETE: "athlete",
  RECRUITER: "recruiter",
} as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];

export const PLANS = ["BASIC", "PRO", "ELITE"] as const;
export type Plan = (typeof PLANS)[number];

export const ACADEMY_STATUSES = ["active", "inactive"] as const;
export type AcademyStatus = (typeof ACADEMY_STATUSES)[number];

export async function getCurrentUser() {
  const jar = await cookies();
  const uid = readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid }, include: { academy: true } });
}

export type Session = {
  userId: string;
  name: string;
  role: string; // super_admin | academy_admin | coach | ...
  academyId: string | null;
  academyName: string | null;
  academyStatus: string | null;
  academyPlan: string | null;
  coachId: string | null;
  athleteId: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean; // academy-level admin (academy_admin)
  isAthlete: boolean;
};

// Post-login landing per role: athletes get their own workspace, super-admins the
// platform portal, everyone else the academy dashboard.
export function homeForRole(role: string): string {
  if (role === ROLE.SUPER_ADMIN) return "/super-admin";
  if (role === ROLE.ATHLETE) return "/app"; // LEAF APP — the athlete's mobile home
  return "/dashboard";
}

export async function getSession(): Promise<Session | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  return {
    userId: u.id,
    name: u.name,
    role: u.role,
    academyId: u.academyId,
    academyName: u.academy?.name ?? null,
    academyStatus: u.academy?.status ?? null,
    academyPlan: u.academy?.plan ?? null,
    coachId: u.coachId,
    athleteId: u.athleteId,
    isSuperAdmin: u.role === ROLE.SUPER_ADMIN,
    isAdmin: u.role === ROLE.ACADEMY_ADMIN,
    isAthlete: u.role === ROLE.ATHLETE,
  };
}

// Guard for the athlete workspace (/me). Returns the linked athleteId or redirects.
export async function requireAthleteId(): Promise<string> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.isAthlete || !s.athleteId) redirect(homeForRole(s.role));
  return s.athleteId;
}

// Platform-level guard. Only SUPER_ADMIN may pass; everyone else goes to their workspace.
export async function requireSuperAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.isSuperAdmin) redirect("/dashboard");
  return s;
}

// Server-side guard for academy admin-only pages. Coaches are sent to their own workspace,
// super admins to the platform portal.
export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.isSuperAdmin) redirect("/super-admin");
  if (!s.isAdmin) redirect("/dashboard");
  return s;
}

// Returns the active coach's id, or redirects if the session isn't a linked coach.
export async function requireCoachId(): Promise<string> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.isSuperAdmin) redirect("/super-admin");
  if (s.isAdmin) redirect("/dashboard");
  if (!s.coachId) redirect("/dashboard");
  return s.coachId;
}

export async function getActiveAcademy() {
  const user = await getCurrentUser();
  return user?.academy ?? null;
}

export async function getActiveAcademyId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.academyId ?? null;
}

// Resolve the tenant id for the current request. Every academy-scoped query funnels
// through this so a user can only ever read/write their own academy's data.
// SUPER_ADMIN is platform-level (no tenant) and must NOT use academy-scoped queries —
// it operates through the /super-admin portal instead, so we fail loudly here.
export async function requireAcademyId(): Promise<string> {
  const user = await getCurrentUser();
  if (user?.role === ROLE.SUPER_ADMIN) {
    throw new Error("SUPER_ADMIN has no tenant scope — use the /super-admin portal.");
  }
  if (user?.academyId) return user.academyId;
  // No session (or a user with no tenant) NEVER falls back to another
  // academy's data — the old "first academy" prototype fallback was a
  // cross-tenant leak. Send them to sign in instead.
  redirect("/login");
}

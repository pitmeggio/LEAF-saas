import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "academy_uid";

export async function getCurrentUser() {
  const jar = await cookies();
  const uid = jar.get(SESSION_COOKIE)?.value;
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid }, include: { academy: true } });
}

export type Session = {
  userId: string;
  name: string;
  role: string; // academy_admin | coach | ...
  academyId: string | null;
  academyName: string | null;
  coachId: string | null;
  isAdmin: boolean;
};

export async function getSession(): Promise<Session | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  return {
    userId: u.id,
    name: u.name,
    role: u.role,
    academyId: u.academyId,
    academyName: u.academy?.name ?? null,
    coachId: u.coachId,
    isAdmin: u.role === "academy_admin",
  };
}

// Server-side guard for admin-only pages. Coaches are sent to their own workspace.
export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.isAdmin) redirect("/");
  return s;
}

// Returns the active coach's id, or redirects if the session isn't a linked coach.
export async function requireCoachId(): Promise<string> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.isAdmin) redirect("/");
  if (!s.coachId) redirect("/");
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

export async function requireAcademyId(): Promise<string> {
  const id = await getActiveAcademyId();
  // Fallback to first academy keeps the prototype resilient if the cookie is stale.
  if (id) return id;
  const first = await prisma.academy.findFirst();
  if (!first) throw new Error("No academy found");
  return first.id;
}

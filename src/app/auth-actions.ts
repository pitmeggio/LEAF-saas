"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, homeForRole } from "@/lib/auth";
import { makeSessionToken, hashPassword, verifyPassword } from "@/lib/password";

async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, makeSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

// One-click demo sign-in (the login page's demo user list). Enabled by default so
// the showcase works everywhere; set DISABLE_DEMO_LOGIN=1 to turn it off.
export async function signIn(userId: string) {
  if (process.env.DISABLE_DEMO_LOGIN === "1") redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  await setSession(userId);
  redirect(homeForRole(user?.role ?? "coach"));
}

export type SignInState = { error?: string };

// Email/password sign-in. Verifies a bcrypt hash. Accounts without a hash yet
// (legacy/demo rows) are "claimed" on first sign-in: the entered password becomes
// their credential. The session cookie is signed (see lib/password).
export async function signInWithEmail(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const user = await prisma.user.findFirst({ where: { email: { equals: email } } });
  if (!user) return { error: "No account found for that email." };

  if (user.passwordHash) {
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return { error: "Incorrect password." };
  } else {
    // First sign-in for a credential-less account → set the password now.
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  }

  await setSession(user.id);
  redirect(homeForRole(user.role));
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, homeForRole } from "@/lib/auth";
import { makeSessionToken, hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit, callerIp } from "@/lib/rateLimit";

async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, makeSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

// One-click demo sign-in (the login page's demo user list). OFF by default —
// this lists every user's email and lets anyone log in as them. Only the
// public LEAF demo site should opt back in with LEAF_DEMO_LOGIN="1".
//
// Server-side guard runs even if a stale UI button leaks through: without
// the env var, the action redirects to /login instead of issuing a session.
export async function signIn(userId: string) {
  if (process.env.LEAF_DEMO_LOGIN !== "1") redirect("/login");
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
  if (!email || !password) return { error: "Inserisci email e password." };

  // Brute-force guard: 5 attempts / 5 minutes per (ip, email). The generic
  // error below also avoids confirming whether an email has an account.
  const ip = await callerIp();
  if (!rateLimit(`login:${ip}:${email}`, 5, 5 * 60_000)) {
    return { error: "Troppi tentativi. Riprova tra qualche minuto." };
  }

  const generic = { error: "Email o password non corretti." };
  const user = await prisma.user.findFirst({ where: { email: { equals: email } } });
  if (!user) return generic;

  if (user.passwordHash) {
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return generic;
  } else if (process.env.LEAF_DEMO_LOGIN === "1") {
    // Demo environments only: first sign-in "claims" a credential-less account.
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  } else {
    // Credential-less account outside demo mode: never claimable by whoever
    // types the email first — the admin must set a password explicitly.
    return generic;
  }

  await setSession(user.id);
  redirect(homeForRole(user.role));
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

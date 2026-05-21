"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";

async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function signIn(userId: string) {
  await setSession(userId);
  redirect("/dashboard");
}

export type SignInState = { error?: string };

// Email/password sign-in. NOTE: password is not yet verified (real auth is a later
// phase) — we authenticate by email lookup. The UI presents a normal credentials form.
export async function signInWithEmail(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const user = await prisma.user.findFirst({ where: { email: { equals: email } } });
  if (!user) return { error: "No account found for that email." };

  await setSession(user.id);
  redirect("/dashboard");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

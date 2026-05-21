import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";

// ── Password hashing ─────────────────────────────────────────────────────────
const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── Signed session tokens ────────────────────────────────────────────────────
// The session cookie stores `userId.signature` so a tampered/forged userId is
// rejected. AUTH_SECRET should be set in production; the dev fallback keeps local
// runs working but is NOT secret.
const SECRET = process.env.AUTH_SECRET || "leaf-dev-secret-change-me";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function makeSessionToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const userId = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = sign(userId);
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

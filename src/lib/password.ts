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
// rejected. AUTH_SECRET is REQUIRED in production — with a known fallback the
// signature is forgeable by anyone who learns a userId, so refuse to run
// insecure. The dev fallback only applies outside production.
// Resolved lazily (per call, cached) so a missing secret only fails at request
// time — never during `next build`, which runs with NODE_ENV=production.
let _secret: string | null = null;
function secret(): string {
  if (_secret) return _secret;
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return (_secret = s);
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production (>= 16 chars). Set it in the environment.");
  }
  return (_secret = "leaf-dev-secret-change-me");
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
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

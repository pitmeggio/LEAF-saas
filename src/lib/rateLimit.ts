import { headers } from "next/headers";

// Minimal in-memory sliding-window rate limiter for public endpoints (login,
// public bookings/registrations). Per-instance only — good enough to stop
// casual brute force and spam floods today; swap for Upstash/Redis when the
// app runs on more than one instance.

type Bucket = { hits: number[] };
const store = new Map<string, Bucket>();

// Periodic sweep so the map can't grow unbounded.
let lastSweep = 0;
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) {
    b.hits = b.hits.filter((t) => now - t < windowMs);
    if (b.hits.length === 0) store.delete(k);
  }
}

/**
 * Returns true when the call is allowed, false when the key exceeded
 * `limit` calls within `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now, windowMs);
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) { store.set(key, bucket); return false; }
  bucket.hits.push(now);
  store.set(key, bucket);
  return true;
}

/** Best-effort caller IP for keying public-endpoint limits. */
export async function callerIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

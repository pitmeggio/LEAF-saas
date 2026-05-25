// Supabase Storage — thin REST wrapper for coach-note attachments.
// No SDK dependency: a couple of fetch calls. Designed around a single
// private bucket "coach-notes"; uploads return a signed URL valid for one
// week, which the UI persists alongside the filename and mimeType.
//
// Setup required on Supabase (one-time, dashboard):
//   1. Storage → New bucket → "coach-notes" → private
//   2. Project settings → API → copy the "service_role" key (server-only!)
//   3. Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to .env

// Per-request cap. Vercel limits Server Actions / route handler bodies to
// ~4.5MB; we cap at 4MB to leave headroom for multipart overhead.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 1 week
const DEFAULT_BUCKET = "coach-notes";

export function storageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function baseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL not set");
  return url.replace(/\/$/, "");
}
function serviceKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return k;
}
function bucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET ?? DEFAULT_BUCKET;
}

export type UploadResult = {
  url: string;        // signed URL (valid for SIGNED_URL_TTL_SECONDS)
  path: string;       // path within the bucket — kept for future re-signing
  filename: string;
  mimeType: string;
  size: number;
};

// Upload a file into the bucket at path. Throws on any non-2xx response so
// the caller surfaces a clean error. The path embeds an academyId+athleteId
// prefix so the namespace is naturally tenant-scoped on disk.
export async function uploadToStorage(opts: {
  bytes: ArrayBuffer | Uint8Array;
  path: string;          // e.g. "academyId/athleteId/timestamp-filename.pdf"
  contentType: string;
}): Promise<{ path: string }> {
  if (!storageConfigured()) throw new Error("Storage not configured");
  const target = `${baseUrl()}/storage/v1/object/${bucket()}/${encodeURI(opts.path)}`;
  const res = await fetch(target, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey()}`,
      "Content-Type": opts.contentType || "application/octet-stream",
      // Upsert so a re-upload to the same path doesn't 409 — the path is
      // already timestamped, so collisions are intentional, not accidental.
      "x-upsert": "true",
    },
    body: opts.bytes as BodyInit,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Storage upload failed (${res.status}): ${text || res.statusText}`);
  }
  return { path: opts.path };
}

// Request a one-week signed URL for an uploaded file. Private bucket only —
// public buckets can just construct the URL directly.
export async function getSignedUrl(path: string): Promise<string> {
  if (!storageConfigured()) throw new Error("Storage not configured");
  const target = `${baseUrl()}/storage/v1/object/sign/${bucket()}/${encodeURI(path)}`;
  const res = await fetch(target, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Signed URL failed (${res.status}): ${text || res.statusText}`);
  }
  const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const rel = data.signedURL ?? data.signedUrl;
  if (!rel) throw new Error("Signed URL response missing signedURL field");
  // Supabase returns a relative path — prefix with the base URL.
  return `${baseUrl()}/storage/v1${rel.startsWith("/") ? rel : `/${rel}`}`;
}

// Cheap filename sanitiser — keep alphanumerics, dots, dashes, underscores.
// Anything else collapses to "_" so the path stays valid for both Storage
// and any signed-URL clients that don't tolerate exotic characters.
export function safeFilename(name: string): string {
  const trimmed = (name || "file").trim().slice(0, 120);
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

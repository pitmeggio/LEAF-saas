// POST /api/coach-notes/upload — receives a single file (multipart/form-data)
// from the coach composer, validates size + mime, uploads to Supabase Storage,
// and returns the metadata the composer needs to register the attachment.
//
// The bucket is private so the response carries a signed URL (~1 week TTL).
// If storage isn't configured the route returns 501 — the UI keeps the
// paste-link path as a permanent fallback.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireAcademyId } from "@/lib/auth";
import {
  uploadToStorage,
  getSignedUrl,
  safeFilename,
  storageConfigured,
  MAX_UPLOAD_BYTES,
} from "@/lib/storage";

export const runtime = "nodejs";

// Reasonable list — coaches realistically upload reports, scouting sheets,
// video links. We deny executables, archives, anything that doesn't render
// in a browser tab.
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "text/plain",
  "text/csv",
]);

export async function POST(req: Request) {
  if (!storageConfigured()) {
    return NextResponse.json(
      { error: "Storage not configured. Paste a link instead, or set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY." },
      { status: 501 },
    );
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const academyId = await requireAcademyId();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  const athleteId = form.get("athleteId");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (typeof athleteId !== "string" || !athleteId) return NextResponse.json({ error: "Missing athleteId." }, { status: 400 });

  if (file.size === 0) return NextResponse.json({ error: "File is empty." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB).` }, { status: 413 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type (${file.type || "unknown"}).` }, { status: 415 });
  }

  // Scope guard — the athlete must belong to the caller's academy. Coach
  // scope is enforced again by the createCoachNote action, but blocking
  // uploads here prevents wasting Storage quota on stray requests.
  const athlete = await prisma.athlete.findFirst({
    where: { id: athleteId, enrollments: { some: { academyId } } },
    select: { id: true },
  });
  if (!athlete) return NextResponse.json({ error: "Athlete not in this academy." }, { status: 403 });

  // Path: <academyId>/<athleteId>/<timestamp>-<safe-name>. Timestamped to
  // avoid collisions; per-tenant prefix keeps the storage namespace tidy.
  const filename = safeFilename(file.name);
  const path = `${academyId}/${athleteId}/${Date.now()}-${filename}`;

  try {
    const bytes = await file.arrayBuffer();
    await uploadToStorage({ bytes, path, contentType: file.type });
    const url = await getSignedUrl(path);
    return NextResponse.json({
      url,
      path,
      filename,
      mimeType: file.type,
      size: file.size,
    });
  } catch (err) {
    console.error("[coach-notes/upload] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 },
    );
  }
}

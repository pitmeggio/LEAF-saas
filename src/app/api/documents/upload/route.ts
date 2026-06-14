import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import { ALL_DOC_TYPES } from "@/lib/enrollmentLogic";

// In-app document upload ("App Documents"). Stores the file bytes in Postgres
// (Document.fileData / bytea) so it works on any deploy with zero extra infra.
// A route handler (not a Server Action) keeps binary multipart clean and
// sidesteps the Server-Action body-size limit. Swap the storage line for an
// object store later without touching the client.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — generous for a certificate/contract

// pdf / word / excel — by request. Map extension → canonical mime as a fallback
// for browsers that send application/octet-stream.
const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const ALLOWED_MIME = new Set<string>(Object.values(EXT_MIME));

export async function POST(request: Request) {
  let academyId: string;
  try {
    academyId = await requireAcademyId();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });

  const enrollmentId = String(form.get("enrollmentId") ?? "");
  const type = String(form.get("type") ?? "");
  const documentId = form.get("documentId") ? String(form.get("documentId")) : null;
  const file = form.get("file");

  if (!enrollmentId || !(ALL_DOC_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ ok: false, error: "Pick an athlete and a document type" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "No file selected" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File too large (max 10 MB)" }, { status: 400 });
  }

  // Resolve mime: trust the browser only if it's in the allow-list, else infer
  // from the extension. Reject anything that isn't pdf / word / excel.
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = ALLOWED_MIME.has(file.type) ? file.type : EXT_MIME[ext];
  if (!mime) {
    return NextResponse.json({ ok: false, error: "Only PDF, Word and Excel files are allowed" }, { status: 400 });
  }

  // Tenant scoping: the enrollment must belong to this academy.
  const enrollment = await prisma.enrollment.findFirst({ where: { id: enrollmentId, academyId }, select: { id: true } });
  if (!enrollment) return NextResponse.json({ ok: false, error: "Athlete not found" }, { status: 404 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const data = {
    fileName: file.name,
    fileMime: mime,
    fileSize: file.size,
    fileData: bytes,
    uploadedAt: new Date(),
    status: "uploaded",
  };

  // Upload to an existing Document row when one is targeted (or one already
  // exists for this athlete+type), otherwise create a new one. Keeps the
  // compliance tracker tidy — one row per required document.
  const existing = documentId
    ? await prisma.document.findFirst({ where: { id: documentId, academyId }, select: { id: true } })
    : await prisma.document.findFirst({ where: { academyId, enrollmentId, type }, select: { id: true } });

  const saved = existing
    ? await prisma.document.update({ where: { id: existing.id }, data })
    : await prisma.document.create({ data: { academyId, enrollmentId, type, required: false, ...data } });

  await prisma.enrollmentEvent.create({
    data: { enrollmentId, type: "document", to: "uploaded", detail: `Uploaded ${file.name}` },
  });

  revalidatePath("/dashboard/documents");
  revalidatePath(`/dashboard/athletes/${enrollmentId}`);
  return NextResponse.json({ ok: true, id: saved.id });
}

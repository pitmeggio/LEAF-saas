import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";

// Streams a stored document's bytes. Tenant-scoped: only files belonging to the
// caller's academy are served. PDFs render inline; Office files download.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let academyId: string;
  try {
    academyId = await requireAcademyId();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.document.findFirst({
    where: { id, academyId },
    select: { fileName: true, fileMime: true, fileData: true },
  });
  if (!doc || !doc.fileData) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const bytes = new Uint8Array(doc.fileData);
  const mime = doc.fileMime ?? "application/octet-stream";
  const inline = mime === "application/pdf";
  const name = (doc.fileName ?? "document").replace(/"/g, "");

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

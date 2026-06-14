import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";

// Streams a stored expense receipt's bytes. Tenant-scoped: only receipts in the
// caller's academy are served. Images + PDFs render inline (so admins can eyeball
// the kvittering during approval).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let academyId: string;
  try {
    academyId = await requireAcademyId();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const r = await prisma.expenseReceipt.findFirst({
    where: { id, academyId },
    select: { fileName: true, fileMime: true, fileData: true },
  });
  if (!r || !r.fileData) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const bytes = new Uint8Array(r.fileData);
  const mime = r.fileMime ?? "application/octet-stream";
  const name = (r.fileName ?? "receipt").replace(/"/g, "");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

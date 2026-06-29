import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Download a dossier file's bytes. Tenant-scoped: the file's academy must match
// the caller's session academy.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || !s.academyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const row = await prisma.athleteFile.findFirst({
    where: { id, academyId: s.academyId },
    select: { fileData: true, fileMime: true, fileName: true },
  });
  if (!row || !row.fileData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = new Uint8Array(row.fileData);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": row.fileMime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.fileName ?? "file")}"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}

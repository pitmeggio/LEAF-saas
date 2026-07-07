import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Download a timesheet's attached Excel. Tenant-scoped; a coach may only fetch
// their own file, admin/office any file in their academy.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || !s.academyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const row = await prisma.timesheet.findFirst({
    where: { id, academyId: s.academyId },
    select: { fileData: true, fileMime: true, fileName: true, coachId: true },
  });
  if (!row || !row.fileData) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Coaches can only download their own timesheet file.
  if (!s.isAdmin && !s.isOffice && s.coachId !== row.coachId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = new Uint8Array(row.fileData);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": row.fileMime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.fileName ?? "foglio-ore")}"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}

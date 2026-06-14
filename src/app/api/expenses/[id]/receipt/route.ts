import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession, requireAcademyId } from "@/lib/auth";

// Receipt photo upload for an expense — the PowerOffice "snap the kvittering"
// flow. Stores the image/PDF bytes in Postgres (ExpenseReceipt.fileData / bytea).
// A route handler keeps binary multipart clean and sidesteps the Server-Action
// body-size limit. Mirrors the document upload, scoped to the expense owner.

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB — phone photos can be a few MB each

// Receipts are photos or PDFs. Accept the common phone/image mimes + PDF.
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  let academyId: string;
  try {
    academyId = await requireAcademyId();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const expense = await prisma.expense.findFirst({ where: { id, academyId }, select: { id: true, coachId: true, status: true } });
  if (!expense) return NextResponse.json({ ok: false, error: "Expense not found" }, { status: 404 });

  // Scoping: a coach can only attach to their own expense, and only while it's
  // still editable (draft / submitted — not after the academy approved it).
  if (!s.isAdmin) {
    if (expense.coachId !== s.coachId) return NextResponse.json({ ok: false, error: "Not your expense" }, { status: 403 });
    if (expense.status !== "draft" && expense.status !== "submitted") {
      return NextResponse.json({ ok: false, error: "This expense is locked — receipts can't be changed after approval." }, { status: 403 });
    }
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, error: "No file selected" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "File too large (max 12 MB)" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = ALLOWED_MIME.has(file.type) ? file.type : EXT_MIME[ext];
  if (!mime) return NextResponse.json({ ok: false, error: "Receipts must be a photo (JPG/PNG/HEIC) or PDF" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const receipt = await prisma.expenseReceipt.create({
    data: {
      academyId,
      expenseId: expense.id,
      fileName: file.name,
      fileMime: mime,
      fileSize: file.size,
      fileData: bytes,
      uploadedById: s.userId ?? null,
      uploadedByName: s.name ?? null,
    },
    select: { id: true },
  });
  await prisma.expenseEvent.create({
    data: { expenseId: expense.id, type: "edited", byUserId: s.userId ?? null, byName: s.name ?? null, note: `Attached receipt ${file.name}` },
  });

  revalidatePath("/dashboard/expenses");
  return NextResponse.json({ ok: true, id: receipt.id });
}

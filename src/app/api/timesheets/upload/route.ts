import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Foglio ore submission (coach). Period + hours + optional hourly rate + an
// optional source Excel (stored as bytea, same zero-infra pattern as the
// dossier). Multipart route sidesteps the Server-Action body limit for the file.

const MAX_BYTES = 15 * 1024 * 1024;
const EXT_MIME: Record<string, string> = {
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  pdf: "application/pdf",
};
const ALLOWED = new Set(Object.values(EXT_MIME));

export async function POST(request: Request) {
  const s = await getSession();
  if (!s || !s.academyId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!s.coachId) return NextResponse.json({ ok: false, error: "Solo i maestri possono inviare il foglio ore." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Form non valido" }, { status: 400 });

  const period = String(form.get("period") ?? "").trim();
  const hours = Number(String(form.get("hours") ?? ""));
  const rateRaw = String(form.get("hourlyRate") ?? "").trim();
  const note = String(form.get("note") ?? "").trim() || null;
  const file = form.get("file");

  if (!period) return NextResponse.json({ ok: false, error: "Indica il periodo (es. 2026-07)." }, { status: 400 });
  if (!Number.isFinite(hours) || hours <= 0 || hours > 1000) return NextResponse.json({ ok: false, error: "Ore non valide." }, { status: 400 });
  const hourlyRate = rateRaw !== "" && Number.isFinite(Number(rateRaw)) && Number(rateRaw) >= 0 ? Math.round(Number(rateRaw)) : null;

  // Resolve the coach's display name (denormalized onto the timesheet).
  const coach = await prisma.coach.findFirst({ where: { id: s.coachId, academyId: s.academyId }, select: { name: true } });
  if (!coach) return NextResponse.json({ ok: false, error: "Maestro non trovato." }, { status: 404 });

  let fileName: string | null = null, fileMime: string | null = null, fileSize: number | null = null;
  let fileData: Uint8Array<ArrayBuffer> | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "File troppo grande (max 15 MB)." }, { status: 400 });
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = ALLOWED.has(file.type) ? file.type : EXT_MIME[ext];
    if (!mime) return NextResponse.json({ ok: false, error: "Formato non supportato (Excel, CSV, PDF)." }, { status: 400 });
    fileName = file.name; fileMime = mime; fileSize = file.size; fileData = new Uint8Array(await file.arrayBuffer());
  }

  try {
    const saved = await prisma.timesheet.create({
      data: {
        academyId: s.academyId, coachId: s.coachId, coachName: coach.name,
        period, hours, hourlyRate, status: "submitted",
        note, fileName, fileMime, fileSize, fileData,
      },
      select: { id: true },
    });
    revalidatePath("/dashboard/timesheets");
    revalidatePath("/dashboard/finance");
    return NextResponse.json({ ok: true, id: saved.id });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return NextResponse.json({ ok: false, error: "Modulo Foglio ore non ancora attivato sul database." }, { status: 503 });
    throw e;
  }
}

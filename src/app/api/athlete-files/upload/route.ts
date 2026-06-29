import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Staff Dossier upload. Stores the file bytes in Postgres (AthleteFile.fileData
// / bytea) — same zero-infra pattern as the compliance Document upload. A route
// handler keeps multipart clean and sidesteps the Server-Action body limit.

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — evaluation sheets, scans, short clips

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  heic: "image/heic",
};
const ALLOWED_MIME = new Set<string>(Object.values(EXT_MIME));
const CATEGORIES = new Set(["evaluation", "match_report", "physical", "medical", "video", "scouting", "file"]);

// Tennis athletes link to the academy via a season plan or an enrollment.
async function ownsAthlete(athleteId: string, academyId: string) {
  return prisma.athlete.findFirst({
    where: { id: athleteId, OR: [{ tennisSeasonPlans: { some: { academyId } } }, { enrollments: { some: { academyId } } }] },
    select: { id: true },
  });
}

export async function POST(request: Request) {
  const s = await getSession();
  if (!s || !s.academyId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Form non valido" }, { status: 400 });

  const athleteId = String(form.get("athleteId") ?? "");
  const category = String(form.get("category") ?? "file");
  const title = String(form.get("title") ?? "").trim();
  const note = String(form.get("note") ?? "").trim() || null;
  const authorRole = String(form.get("authorRole") ?? "").trim() || null;
  const observedRaw = String(form.get("observedAt") ?? "");
  const scoreRaw = String(form.get("score") ?? "").trim();
  const scaleRaw = String(form.get("scoreScale") ?? "").trim();
  const file = form.get("file");

  if (!athleteId || !CATEGORIES.has(category)) return NextResponse.json({ ok: false, error: "Dati mancanti" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, error: "Nessun file selezionato" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "File troppo grande (max 20 MB)" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = ALLOWED_MIME.has(file.type) ? file.type : EXT_MIME[ext];
  if (!mime) return NextResponse.json({ ok: false, error: "Formato non supportato (PDF, Word, Excel, CSV, immagini)" }, { status: 400 });

  if (!(await ownsAthlete(athleteId, s.academyId))) return NextResponse.json({ ok: false, error: "Atleta non trovato" }, { status: 404 });

  const observedAt = observedRaw && !isNaN(new Date(observedRaw).getTime()) ? new Date(observedRaw) : new Date();
  const score = scoreRaw !== "" && !isNaN(Number(scoreRaw)) ? Number(scoreRaw) : null;
  const scoreScale = score != null ? (scaleRaw !== "" && Number(scaleRaw) > 0 ? Math.round(Number(scaleRaw)) : 10) : null;

  const bytes = Buffer.from(await file.arrayBuffer());
  const saved = await prisma.athleteFile.create({
    data: {
      academyId: s.academyId, athleteId,
      authorId: s.userId, authorName: s.name, authorRole,
      category, title: title || file.name, note,
      score, scoreScale, observedAt,
      fileName: file.name, fileMime: mime, fileSize: file.size, fileData: bytes,
    },
    select: { id: true },
  });

  revalidatePath(`/dashboard/canvas/${athleteId}`);
  return NextResponse.json({ ok: true, id: saved.id });
}

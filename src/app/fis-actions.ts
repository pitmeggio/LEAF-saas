"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importAthleteByFisCode } from "@/lib/fis/import";
import { fisImportSchema, firstError } from "@/lib/validation";
import { requireAcademyId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type ImportState = { error?: string };

export async function importFisAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const parsed = fisImportSchema.safeParse({ fisCode: formData.get("fisCode") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const code = parsed.data.fisCode;

  const result = await importAthleteByFisCode(code);
  if (!result) return { error: `No FIS record found for "${code}". Check the code and try again.` };

  // The athlete-profile page (/dashboard/athletes/[id]) keys off ENROLLMENT
  // id, not athlete id — an academy roster is a set of enrolments, an
  // unenrolled athlete record is invisible. So when we import a brand-new
  // FIS athlete we also drop in an enrolment for the current academy with
  // status "active" and no team / package / coach yet. The admin completes
  // the assignment from the detail page that opens next.
  const academyId = await requireAcademyId();
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { athleteId: result.athleteId, academyId },
    select: { id: true },
  });
  const enrollmentId = existingEnrollment
    ? existingEnrollment.id
    : (
        await prisma.enrollment.create({
          data: {
            academyId,
            athleteId: result.athleteId,
            status: "active",
          },
          select: { id: true },
        })
      ).id;

  revalidatePath("/dashboard/athletes");
  revalidatePath(`/dashboard/athletes/${enrollmentId}`);
  redirect(`/dashboard/athletes/${enrollmentId}?imported=${result.created ? "new" : "updated"}`);
}

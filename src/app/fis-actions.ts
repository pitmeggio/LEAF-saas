"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importAthleteByFisCode } from "@/lib/fis/import";
import { fisImportSchema, firstError } from "@/lib/validation";

export type ImportState = { error?: string };

export async function importFisAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const parsed = fisImportSchema.safeParse({ fisCode: formData.get("fisCode") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const code = parsed.data.fisCode;

  const result = await importAthleteByFisCode(code);
  if (!result) return { error: `No FIS record found for "${code}". Check the code and try again.` };

  // Athlete pages live under /dashboard/athletes since the great rename of
  // task #82. Don't redirect to the old /athletes/* — it would 404.
  revalidatePath("/dashboard/athletes");
  revalidatePath(`/dashboard/athletes/${result.athleteId}`);
  redirect(`/dashboard/athletes/${result.athleteId}?imported=${result.created ? "new" : "updated"}`);
}

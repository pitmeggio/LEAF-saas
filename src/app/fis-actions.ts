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

  revalidatePath("/athletes");
  revalidatePath(`/athletes/${result.athleteId}`);
  redirect(`/athletes/${result.athleteId}?imported=${result.created ? "new" : "updated"}`);
}

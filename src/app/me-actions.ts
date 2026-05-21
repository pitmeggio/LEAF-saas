"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAthleteId } from "@/lib/auth";
import { firstError } from "@/lib/validation";

export type MyProfileState = { ok?: boolean; error?: string };

const schema = z.object({
  publicBio: z.string().trim().max(1000).optional().transform((v) => (v ? v : null)),
  publicPhotoUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https?:\/\/.+/.test(v), { message: "Photo must be a valid URL." }),
  publicContactEnabled: z.boolean(),
});

// The athlete edits their own bio / photo / contact toggle. Scoped to the
// logged-in athlete's record — they can only ever touch their own profile.
export async function updateMyProfile(_prev: MyProfileState, formData: FormData): Promise<MyProfileState> {
  const athleteId = await requireAthleteId();
  const parsed = schema.safeParse({
    publicBio: formData.get("publicBio") ?? "",
    publicPhotoUrl: formData.get("publicPhotoUrl") ?? "",
    publicContactEnabled: formData.get("publicContactEnabled") === "on",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const a = await prisma.athlete.findUnique({ where: { id: athleteId }, select: { publicSlug: true } });
  await prisma.athlete.update({ where: { id: athleteId }, data: parsed.data });

  revalidatePath("/me");
  if (a?.publicSlug) revalidatePath(`/athlete/${a.publicSlug}`);
  return { ok: true };
}

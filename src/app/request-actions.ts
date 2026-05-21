"use server";

import { prisma } from "@/lib/db";
import { academyRequestSchema, firstError } from "@/lib/validation";

export type RequestState = { ok?: boolean; error?: string };

// Public, unauthenticated: a prospective academy submits an onboarding request.
// Reviewed by the super-admin in /super-admin/requests.
export async function submitAcademyRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const parsed = academyRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  await prisma.academyRequest.create({
    data: {
      academyName: d.academyName,
      contactName: d.contactName,
      email: d.email,
      phone: d.phone ?? null,
      country: d.country,
      location: d.location ?? null,
      sport: d.sport,
      plan: d.plan,
      message: d.message ?? null,
      status: "pending",
    },
  });
  return { ok: true };
}

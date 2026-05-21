"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { opportunityInputSchema, opportunityStatusSchema, firstError, type OpportunityInput } from "@/lib/validation";

export type Result = { ok: boolean; error?: string; id?: string };

function toDeadline(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function revalidate(slug?: string | null) {
  revalidatePath("/dashboard/recruiting");
  if (slug) {
    revalidatePath(`/academy/${slug}`);
    revalidatePath(`/academy/${slug}/apply`);
  }
}

export async function createOpportunity(input: OpportunityInput): Promise<Result> {
  const parsed = opportunityInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "No academy in session." };
  const d = parsed.data;
  const o = await prisma.opportunity.create({
    data: {
      academyId: s.academyId,
      title: d.title,
      type: d.type,
      season: d.season ?? null,
      ageGroup: d.ageGroup ?? null,
      discipline: d.discipline ?? null,
      packageType: d.packageType ?? null,
      price: d.price ?? null,
      currency: d.currency ?? "EUR",
      pricePublic: d.pricePublic,
      applicationDeadline: toDeadline(d.applicationDeadline),
      spotsAvailable: d.spotsAvailable ?? null,
      description: d.description ?? null,
      status: d.status,
    },
  });
  revalidate();
  return { ok: true, id: o.id };
}

export async function updateOpportunity(id: string, input: OpportunityInput): Promise<Result> {
  const parsed = opportunityInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const s = await requireAdmin();
  const existing = await prisma.opportunity.findFirst({ where: { id, academyId: s.academyId ?? "" }, include: { academy: { select: { slug: true } } } });
  if (!existing) return { ok: false, error: "Opportunity not found." };
  const d = parsed.data;
  await prisma.opportunity.update({
    where: { id },
    data: {
      title: d.title,
      type: d.type,
      season: d.season ?? null,
      ageGroup: d.ageGroup ?? null,
      discipline: d.discipline ?? null,
      packageType: d.packageType ?? null,
      price: d.price ?? null,
      currency: d.currency ?? "EUR",
      pricePublic: d.pricePublic,
      applicationDeadline: toDeadline(d.applicationDeadline),
      spotsAvailable: d.spotsAvailable ?? null,
      description: d.description ?? null,
      status: d.status,
    },
  });
  revalidate(existing.academy.slug);
  return { ok: true, id };
}

// Publish / unpublish (back to draft) / close.
export async function setOpportunityStatus(id: string, status: string): Promise<Result> {
  const parsed = opportunityStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  const s = await requireAdmin();
  const existing = await prisma.opportunity.findFirst({ where: { id, academyId: s.academyId ?? "" }, include: { academy: { select: { slug: true } } } });
  if (!existing) return { ok: false, error: "Opportunity not found." };
  await prisma.opportunity.update({ where: { id }, data: { status: parsed.data } });
  revalidate(existing.academy.slug);
  return { ok: true, id };
}

export async function deleteOpportunity(id: string): Promise<Result> {
  const s = await requireAdmin();
  const existing = await prisma.opportunity.findFirst({ where: { id, academyId: s.academyId ?? "" }, include: { academy: { select: { slug: true } }, _count: { select: { applications: true } } } });
  if (!existing) return { ok: false, error: "Opportunity not found." };
  // Keep applications; just detach them from the deleted opportunity.
  if (existing._count.applications > 0) {
    await prisma.application.updateMany({ where: { opportunityId: id }, data: { opportunityId: null } });
  }
  await prisma.opportunity.delete({ where: { id } });
  revalidate(existing.academy.slug);
  return { ok: true };
}

"use server";

import { prisma } from "@/lib/db";
import { getSession, requireAcademyId } from "@/lib/auth";
import { chatMessageSchema, conversationStatusSchema, firstError } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type Result = { ok: boolean; error?: string };

function preview(body: string) {
  return body.length > 80 ? body.slice(0, 80) + "…" : body;
}

function revalidateChat(id: string) {
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${id}`);
  revalidatePath("/");
}

// Verify a staff member may access this conversation (admin = any; coach = scoped).
async function staffCanAccess(conversationId: string) {
  const s = await getSession();
  if (!s) return { s: null, conv: null };
  const academyId = await requireAcademyId();
  const conv = await prisma.conversation.findFirst({
    where: s.isAdmin
      ? { id: conversationId, academyId }
      : { id: conversationId, academyId, OR: [{ enrollment: { coachId: s.coachId ?? "__none__" } }, { assignedToUserId: s.userId }] },
  });
  return { s, conv };
}

export async function sendStaffMessage(conversationId: string, body: string): Promise<Result> {
  const parsed = chatMessageSchema.safeParse({ conversationId, body });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { s, conv } = await staffCanAccess(conversationId);
  if (!s || !conv) return { ok: false, error: "Not found" };

  await prisma.message.create({
    data: { conversationId: conv.id, senderSide: "staff", senderRole: s.isAdmin ? "admin" : "coach", senderName: s.name, senderUserId: s.userId, body: parsed.data.body },
  });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: new Date(), lastMessagePreview: preview(parsed.data.body), lastReadByStaffAt: new Date(), status: conv.status === "waiting" ? "open" : conv.status },
  });
  revalidateChat(conv.id);
  return { ok: true };
}

// Public (applicant/parent/athlete) — no auth, identified by the conversation id.
export async function sendExternalMessage(conversationId: string, body: string, senderName?: string): Promise<Result> {
  const parsed = chatMessageSchema.safeParse({ conversationId, body });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) return { ok: false, error: "Not found" };

  await prisma.message.create({
    data: { conversationId: conv.id, senderSide: "external", senderRole: "applicant", senderName: senderName?.trim() || "Applicant", body: parsed.data.body },
  });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: new Date(), lastMessagePreview: preview(parsed.data.body), lastReadByExternalAt: new Date(), status: "waiting" },
  });
  revalidatePath(`/c/${conv.id}`);
  revalidateChat(conv.id);
  return { ok: true };
}

export async function setConversationStatus(conversationId: string, status: string): Promise<Result> {
  const parsed = conversationStatusSchema.safeParse({ conversationId, status });
  if (!parsed.success) return { ok: false, error: "Invalid status" };
  const { conv } = await staffCanAccess(conversationId);
  if (!conv) return { ok: false, error: "Not found" };
  await prisma.conversation.update({ where: { id: conv.id }, data: { status: parsed.data.status } });
  revalidateChat(conv.id);
  return { ok: true };
}

// Admin-only: assign a conversation to a staff member.
export async function assignConversation(conversationId: string, userId: string | null): Promise<Result> {
  const s = await getSession();
  if (!s?.isAdmin) return { ok: false, error: "Admin only" };
  const academyId = await requireAcademyId();
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, academyId } });
  if (!conv) return { ok: false, error: "Not found" };
  if (userId) {
    const u = await prisma.user.findFirst({ where: { id: userId, academyId } });
    if (!u) return { ok: false, error: "Invalid user" };
  }
  await prisma.conversation.update({ where: { id: conv.id }, data: { assignedToUserId: userId } });
  revalidateChat(conv.id);
  return { ok: true };
}

export async function markConversationRead(conversationId: string): Promise<Result> {
  const { conv } = await staffCanAccess(conversationId);
  if (!conv) return { ok: false, error: "Not found" };
  await prisma.conversation.update({ where: { id: conv.id }, data: { lastReadByStaffAt: new Date() } });
  revalidateChat(conv.id);
  return { ok: true };
}

// Operational reminder posted into the thread (connects chat to docs/payments).
export async function postReminder(conversationId: string, kind: "missing_documents" | "payment_overdue"): Promise<Result> {
  const { conv } = await staffCanAccess(conversationId);
  if (!conv) return { ok: false, error: "Not found" };
  const body =
    kind === "missing_documents"
      ? "Reminder: some required documents are still outstanding. Please upload them to complete enrollment."
      : "Reminder: a payment on your account is overdue. Please arrange payment at your earliest convenience.";
  await prisma.message.create({ data: { conversationId: conv.id, senderSide: "system", senderRole: "system", senderName: "System", body } });
  await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date(), lastMessagePreview: preview(body) } });
  revalidateChat(conv.id);
  return { ok: true };
}

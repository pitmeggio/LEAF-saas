"use server";

// LEAF — Bacheca (Squad Board) server actions.
//   • Staff (requireAdmin): post / pin / delete announcements.
//   • Athlete (requireAthleteId): mark read, acknowledge, RSVP to events.
// Every write is tenant-scoped: staff writes carry the admin's academyId;
// athlete writes verify the target row belongs to the athlete's academy
// (findFirst with academyId) BEFORE any bare-id mutation.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAthleteId, getSession } from "@/lib/auth";
import { firstError } from "@/lib/validation";
import { resolveAthleteContext } from "@/lib/board/board";
import type { RsvpStatus } from "@/lib/board/boardTypes";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

// The Bacheca tables are added additively; until the schema is pushed to the
// shared DB, writes would throw "table does not exist". Turn that transient
// state into a clear message instead of an unhandled crash.
function tablesMissing(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  const msg = (e as { message?: string })?.message ?? "";
  return code === "P2021" || /does not exist/i.test(msg);
}
const NOT_ACTIVE = "Bacheca non ancora attivata sul database. Contatta l'amministratore.";

// ── Staff ────────────────────────────────────────────────────────────────

const postSchema = z.object({
  title: z.string().trim().min(1, "Il titolo è obbligatorio.").max(120),
  body: z.string().trim().min(1, "Scrivi il messaggio.").max(4000),
  audience: z.enum(["all", "group"]).default("all"),
  groupId: z.string().trim().nullish().transform((v) => v || null),
  pinned: z.coerce.boolean().optional().transform((v) => v ?? false),
  requireAck: z.coerce.boolean().optional().transform((v) => v ?? false),
});

export async function postAnnouncement(input: z.input<typeof postSchema>): Promise<Result<{ id: string }>> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  // If targeting a group, that group must belong to this academy.
  let groupId: string | null = null;
  if (d.audience === "group") {
    if (!d.groupId) return { ok: false, error: "Scegli il gruppo destinatario." };
    const g = await prisma.group.findFirst({ where: { id: d.groupId, academyId: s.academyId }, select: { id: true } });
    if (!g) return { ok: false, error: "Gruppo non trovato." };
    groupId = g.id;
  }

  try {
    const created = await prisma.announcement.create({
      data: {
        academyId: s.academyId,
        authorId: s.userId,
        authorName: s.name || "Staff",
        authorRole: s.isAdmin ? "Direzione" : "Coach",
        title: d.title,
        body: d.body,
        audience: d.audience,
        groupId,
        pinned: d.pinned,
        requireAck: d.requireAck,
      },
    });
    revalidatePath("/dashboard/board");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    if (tablesMissing(e)) return { ok: false, error: NOT_ACTIVE };
    throw e;
  }
}

export async function togglePinAnnouncement(id: string): Promise<Result> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  const a = await prisma.announcement.findFirst({ where: { id, academyId: s.academyId }, select: { id: true, pinned: true } });
  if (!a) return { ok: false, error: "Comunicazione non trovata." };
  await prisma.announcement.update({ where: { id: a.id }, data: { pinned: !a.pinned } });
  revalidatePath("/dashboard/board");
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<Result> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  const a = await prisma.announcement.findFirst({ where: { id, academyId: s.academyId }, select: { id: true } });
  if (!a) return { ok: false, error: "Comunicazione non trovata." };
  await prisma.announcement.delete({ where: { id: a.id } });
  revalidatePath("/dashboard/board");
  return { ok: true };
}

// ── Athlete ──────────────────────────────────────────────────────────────

// Confirm an announcement is visible to this athlete before recording a receipt.
async function announcementVisibleTo(announcementId: string, athleteId: string): Promise<boolean> {
  const { academyId, groupIds } = await resolveAthleteContext(athleteId);
  if (!academyId) return false;
  const a = await prisma.announcement.findFirst({
    where: {
      id: announcementId,
      academyId,
      OR: [{ audience: "all" }, { audience: "group", groupId: { in: groupIds.length ? groupIds : ["__none__"] } }],
    },
    select: { id: true },
  });
  return !!a;
}

export async function markAnnouncementRead(announcementId: string): Promise<Result> {
  const athleteId = await requireAthleteId();
  if (!(await announcementVisibleTo(announcementId, athleteId))) return { ok: false, error: "Comunicazione non trovata." };
  await prisma.announcementReceipt.upsert({
    where: { announcementId_athleteId: { announcementId, athleteId } },
    create: { announcementId, athleteId },
    update: {}, // readAt already stamped on first open
  });
  revalidatePath("/app/board");
  revalidatePath("/app");
  return { ok: true };
}

export async function ackAnnouncement(announcementId: string): Promise<Result> {
  const athleteId = await requireAthleteId();
  if (!(await announcementVisibleTo(announcementId, athleteId))) return { ok: false, error: "Comunicazione non trovata." };
  await prisma.announcementReceipt.upsert({
    where: { announcementId_athleteId: { announcementId, athleteId } },
    create: { announcementId, athleteId, ackedAt: new Date() },
    update: { ackedAt: new Date() },
  });
  revalidatePath("/app/board");
  revalidatePath("/app");
  return { ok: true };
}

const rsvpSchema = z.object({
  eventId: z.string().min(1),
  status: z.enum(["going", "not", "maybe"]),
  note: z.string().trim().max(200).nullish().transform((v) => v || null),
});

export async function setEventRsvp(input: z.input<typeof rsvpSchema>): Promise<Result<{ status: RsvpStatus }>> {
  const athleteId = await requireAthleteId();
  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const { academyId } = await resolveAthleteContext(athleteId);
  if (!academyId) return { ok: false, error: "Nessuna academy collegata." };

  // The event must belong to the athlete's academy — verify before writing.
  const ev = await prisma.calendarEvent.findFirst({ where: { id: d.eventId, academyId }, select: { id: true } });
  if (!ev) return { ok: false, error: "Evento non trovato." };

  try {
    await prisma.eventRsvp.upsert({
      where: { eventId_athleteId: { eventId: d.eventId, athleteId } },
      create: { academyId, eventId: d.eventId, athleteId, status: d.status, note: d.note },
      update: { status: d.status, note: d.note, respondedAt: new Date() },
    });
  } catch (e) {
    if (tablesMissing(e)) return { ok: false, error: NOT_ACTIVE };
    throw e;
  }
  revalidatePath("/app");
  revalidatePath("/app/board");
  return { ok: true, data: { status: d.status } };
}

// Used by the home banner: allow a signed-in athlete OR fall back gracefully.
export async function myUnreadCount(): Promise<number> {
  const s = await getSession();
  if (!s?.athleteId) return 0;
  const { countUnread } = await import("@/lib/board/board");
  return countUnread(s.athleteId);
}

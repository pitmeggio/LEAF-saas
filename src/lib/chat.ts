import { prisma } from "@/lib/db";
import { requireAcademyId, getSession } from "@/lib/auth";

// ── Scoping ──
// Admin sees all academy conversations. A coach sees threads for athletes they coach
// OR threads explicitly assigned to them.
function coachScopeWhere(coachId: string | null, userId: string) {
  return { OR: [{ enrollment: { coachId: coachId ?? "__none__" } }, { assignedToUserId: userId }] };
}

const LIST_INCLUDE = {
  application: { select: { id: true, status: true } },
  enrollment: { select: { id: true, coachId: true } },
  athlete: { select: { id: true, firstName: true, lastName: true, photoColor: true } },
  assignedTo: { select: { id: true, name: true } },
  messages: { select: { senderSide: true, createdAt: true } },
};

function unreadFor(conv: { lastReadByStaffAt: Date | null; messages: { senderSide: string; createdAt: Date }[] }) {
  const since = conv.lastReadByStaffAt ? new Date(conv.lastReadByStaffAt).getTime() : 0;
  return conv.messages.filter((m) => m.senderSide === "external" && new Date(m.createdAt).getTime() > since).length;
}

export async function getConversations() {
  const academyId = await requireAcademyId();
  const s = await getSession();
  const where = s?.isAdmin ? { academyId } : { academyId, ...coachScopeWhere(s?.coachId ?? null, s?.userId ?? "") };
  const convs = await prisma.conversation.findMany({ where, include: LIST_INCLUDE, orderBy: { lastMessageAt: "desc" } });
  return convs.map((c) => ({ ...c, unread: unreadFor(c) }));
}

export async function getConversation(id: string) {
  const academyId = await requireAcademyId();
  const s = await getSession();
  const where = s?.isAdmin ? { id, academyId } : { id, academyId, ...coachScopeWhere(s?.coachId ?? null, s?.userId ?? "") };
  const conv = await prisma.conversation.findFirst({
    where,
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      application: true,
      enrollment: { include: { athlete: true } },
      athlete: true,
      assignedTo: { select: { id: true, name: true } },
    },
  });
  return conv;
}

// Public (no-auth) thread access via the conversation id (magic link).
export async function getPublicConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } }, academy: { select: { name: true, slug: true, logoColor: true } }, athlete: { select: { firstName: true, lastName: true } } },
  });
}

// Dashboard rollups (respect role scope).
export async function getInboxStats() {
  const convs = await getConversations();
  return {
    total: convs.length,
    unreadTotal: convs.reduce((s, c) => s + c.unread, 0),
    unreadConversations: convs.filter((c) => c.unread > 0).length,
    waiting: convs.filter((c) => c.status === "waiting").length,
    open: convs.filter((c) => c.status === "open").length,
    resolved: convs.filter((c) => c.status === "resolved").length,
  };
}

// Coach/admin assignment options (staff users).
export async function getStaffUsers() {
  const academyId = await requireAcademyId();
  return prisma.user.findMany({ where: { academyId }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } });
}

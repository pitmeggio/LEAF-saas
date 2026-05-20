import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/ui";
import { ChatThread, StaffReply, ConversationControls, MarkReadOnView } from "@/components/Chat";
import { getConversation, getStaffUsers } from "@/lib/chat";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [conv, session] = await Promise.all([getConversation(id), getSession()]);
  if (!conv) notFound();
  const staff = session?.isAdmin ? await getStaffUsers() : [];
  const ath = conv.enrollment?.athlete ?? conv.athlete;

  return (
    <>
      <MarkReadOnView conversationId={conv.id} />
      <PageHeader
        title={ath ? `${ath.firstName} ${ath.lastName}` : conv.subject ?? "Conversation"}
        subtitle={`${conv.type === "athlete" ? "Athlete chat" : "Application chat"} · ${conv.status}`}
        right={<Link href="/inbox" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">← Inbox</Link>}
      />

      <div className="grid gap-6 p-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-6">
            <ChatThread messages={conv.messages} viewerSide="staff" />
          </div>
          <div className="card p-5">
            <StaffReply conversationId={conv.id} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="mb-3 text-sm font-semibold">Conversation</h3>
            <ConversationControls
              conversationId={conv.id}
              status={conv.status}
              assignedToUserId={conv.assignedToUserId}
              staff={staff}
              isAdmin={session?.isAdmin ?? false}
              showReminders={conv.type === "athlete"}
            />
          </div>

          {ath && (
            <div className="card p-6">
              <h3 className="mb-3 text-sm font-semibold">Linked record</h3>
              <div className="flex items-center gap-3">
                <Avatar first={ath.firstName} last={ath.lastName} color={ath.photoColor} size={40} />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium">{ath.firstName} {ath.lastName}</div>
                  <div className="text-xs text-[var(--color-muted)]">{ath.email ?? ""}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {conv.enrollmentId && <Link href={`/members/${conv.enrollmentId}`} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-center text-xs font-medium hover:bg-[var(--color-surface-2)]">Open athlete profile →</Link>}
                {conv.applicationId && <Link href={`/applications/${conv.applicationId}`} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-center text-xs font-medium hover:bg-[var(--color-surface-2)]">Open application →</Link>}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

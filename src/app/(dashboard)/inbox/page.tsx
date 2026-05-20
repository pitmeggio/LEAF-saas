import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, Dot } from "@/components/StatCard";
import { Avatar } from "@/components/ui";
import { getConversations, getInboxStats } from "@/lib/chat";
import { relativeDate } from "@/lib/domain";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = { open: "#38bdf8", waiting: "#f59e0b", resolved: "#7CFF6B" };

export default async function InboxPage() {
  const [convs, stats] = await Promise.all([getConversations(), getInboxStats()]);

  return (
    <>
      <PageHeader title="Inbox" subtitle="Conversations with applicants, athletes and parents — connected to the operational system." />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Unread messages" value={String(stats.unreadTotal)} danger={stats.unreadTotal > 0} accent={stats.unreadTotal === 0} />
          <StatCard label="Waiting on us" value={String(stats.waiting)} danger={stats.waiting > 0} />
          <StatCard label="Open" value={String(stats.open)} />
          <StatCard label="Resolved" value={String(stats.resolved)} />
        </div>

        <div className="card divide-y divide-[var(--color-border)]">
          {convs.length === 0 && <div className="p-8 text-center text-sm text-[var(--color-muted)]">No conversations.</div>}
          {convs.map((c) => {
            const ath = c.athlete;
            return (
              <Link key={c.id} href={`/inbox/${c.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-surface-2)]">
                {ath ? <Avatar first={ath.firstName} last={ath.lastName} color={ath.photoColor} size={38} /> : <div className="h-[38px] w-[38px] rounded-full bg-[var(--color-surface-2)]" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ath ? `${ath.firstName} ${ath.lastName}` : c.subject}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide" style={{ color: STATUS_COLOR[c.status] }}>
                      <Dot color={STATUS_COLOR[c.status]} /> {c.status}
                    </span>
                    <span className="rounded-md bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] capitalize">{c.type}</span>
                  </div>
                  <div className="truncate text-xs text-[var(--color-muted)]">{c.lastMessagePreview ?? "—"}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-[var(--color-muted)]">{relativeDate(c.lastMessageAt)}</span>
                  {c.unread > 0 && <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-bold text-[#0a0c10]">{c.unread}</span>}
                  {c.assignedTo && <span className="text-[10px] text-[var(--color-muted)]">→ {c.assignedTo.name}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

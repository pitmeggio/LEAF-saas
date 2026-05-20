"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendStaffMessage, sendExternalMessage, setConversationStatus, assignConversation, postReminder, markConversationRead } from "@/app/chat-actions";

// Marks the conversation read for staff when the thread is opened.
export function MarkReadOnView({ conversationId }: { conversationId: string }) {
  useEffect(() => { markConversationRead(conversationId); }, [conversationId]);
  return null;
}

type Msg = { id: string; senderSide: string; senderRole: string | null; senderName: string | null; body: string; createdAt: Date | string };

const ROLE_LABEL: Record<string, string> = { applicant: "Applicant", parent: "Parent", athlete: "Athlete", coach: "Coach", admin: "Admin", system: "System" };

function time(d: Date | string) {
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ChatThread({ messages, viewerSide }: { messages: Msg[]; viewerSide: "staff" | "external" }) {
  return (
    <div className="space-y-3">
      {messages.length === 0 && <p className="text-sm text-[var(--color-muted)]">No messages yet.</p>}
      {messages.map((m) => {
        if (m.senderSide === "system") {
          return (
            <div key={m.id} className="flex justify-center">
              <div className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-center text-xs text-[var(--color-muted)]">{m.body}</div>
            </div>
          );
        }
        const own = m.senderSide === viewerSide;
        return (
          <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${own ? "bg-[var(--color-accent)] text-[#0a0c10]" : "bg-[var(--color-surface-2)] text-[var(--color-fg)] border border-[var(--color-border)]"}`}>
              <div className={`mb-0.5 flex items-center gap-2 text-[10px] ${own ? "text-[#0a0c10]/70" : "text-[var(--color-muted)]"}`}>
                <span className="font-semibold">{m.senderName ?? ROLE_LABEL[m.senderRole ?? ""] ?? "—"}</span>
                <span>· {ROLE_LABEL[m.senderRole ?? ""] ?? m.senderRole}</span>
                <span>· {time(m.createdAt)}</span>
              </div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ta = "w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm outline-none focus:border-[var(--color-accent)]";

export function StaffReply({ conversationId }: { conversationId: string }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const send = () => {
    if (!body.trim()) return;
    const text = body;
    setBody("");
    start(async () => { const r = await sendStaffMessage(conversationId, text); if (!r.ok) { setError(r.error ?? "Error"); setBody(text); } else { setError(null); router.refresh(); } });
  };
  return (
    <div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Reply to this conversation…" className={ta} />
      {error && <p className="mt-1 text-sm text-[#f87171]">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button onClick={send} disabled={pending || !body.trim()} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-40">
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}

export function ExternalReply({ conversationId }: { conversationId: string }) {
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const send = () => {
    if (!body.trim()) return;
    const text = body;
    setBody("");
    start(async () => { await sendExternalMessage(conversationId, text, name || undefined); router.refresh(); });
  };
  return (
    <div className="space-y-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Type your message…" className={ta} />
      <div className="flex justify-end">
        <button onClick={send} disabled={pending || !body.trim()} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-40">
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </div>
  );
}

const STATUSES = ["open", "waiting", "resolved"] as const;
const STATUS_COLOR: Record<string, string> = { open: "#38bdf8", waiting: "#f59e0b", resolved: "#7CFF6B" };

export function ConversationControls({
  conversationId, status, assignedToUserId, staff, isAdmin, showReminders,
}: {
  conversationId: string; status: string; assignedToUserId: string | null; staff: { id: string; name: string }[]; isAdmin: boolean; showReminders: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-xs text-[var(--color-muted)]">Status</div>
        <div className="flex gap-2">
          {STATUSES.map((st) => (
            <button key={st} disabled={pending} onClick={() => run(() => setConversationStatus(conversationId, st))}
              className="rounded-lg px-3 py-1.5 text-xs font-medium capitalize disabled:opacity-50"
              style={st === status ? { background: STATUS_COLOR[st], color: "#0a0c10" } : { background: "var(--color-surface-2)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}>
              {st}
            </button>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div>
          <div className="mb-1.5 text-xs text-[var(--color-muted)]">Assigned to</div>
          <select value={assignedToUserId ?? ""} disabled={pending}
            onChange={(e) => run(() => assignConversation(conversationId, e.target.value || null))}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]">
            <option value="">Unassigned</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}

      {showReminders && (
        <div>
          <div className="mb-1.5 text-xs text-[var(--color-muted)]">Send reminder</div>
          <div className="flex flex-col gap-2">
            <button disabled={pending} onClick={() => run(() => postReminder(conversationId, "missing_documents"))} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-surface-2)] disabled:opacity-50">Missing documents</button>
            <button disabled={pending} onClick={() => run(() => postReminder(conversationId, "payment_overdue"))} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-surface-2)] disabled:opacity-50">Payment overdue</button>
          </div>
        </div>
      )}
    </div>
  );
}

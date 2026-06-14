"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { composeNewConversation } from "@/app/chat-actions";

type Target = { id: string; label: string; type: "athlete" | "application" };

// "+ New message" — by request. Lets staff start a fresh conversation
// (not just reply to existing threads): pick an athlete or applicant, type
// subject + body, send. The server action wires the conversation to the
// athlete/enrollment/application context so the existing Inbox controls
// (status / assignee / reminders) keep working.
export function NewMessageButton({ targets }: { targets: Target[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [targetId, setTargetId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const reset = () => {
    setTargetId("");
    setSubject("");
    setBody("");
    setErr(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const t = targets.find((x) => x.id === targetId);
    if (!t) {
      setErr("Pick a recipient first.");
      return;
    }
    start(async () => {
      const r = await composeNewConversation({
        targetType: t.type,
        targetId: t.id,
        subject,
        body,
      });
      if (r.ok && r.conversationId) {
        close();
        router.push(`/dashboard/inbox/${r.conversationId}`);
        router.refresh();
      } else {
        setErr(r.error ?? "Could not send message.");
      }
    });
  };

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]"
    >
      + New message
    </button>
  );

  if (!open) return trigger;

  const overlay = (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div className="flex min-h-full items-center justify-center py-8">
        <div className="card w-full max-w-lg p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold">New message</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Start a conversation with an athlete or applicant. They&apos;ll receive a notification and reply from the public link they already use.
          </p>
          <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">To *</label>
              <select
                required
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">— pick a recipient —</option>
                {targets.map((t) => (
                  <option key={`${t.type}-${t.id}`} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Subject *</label>
              <input
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Season planning · Saas-Fee camp"
                maxLength={200}
                className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Message *</label>
              <textarea
                required
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message…"
                className="mt-0.5 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            {err && <p className="text-[11px] text-[#f87171]">{err}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={close} className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      {mounted && createPortal(overlay, document.body)}
    </>
  );
}

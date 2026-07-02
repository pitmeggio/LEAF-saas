"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pin, Check, ChevronDown } from "lucide-react";
import { markAnnouncementRead, ackAnnouncement } from "@/app/board-actions";
import { relativeTime, type AnnouncementView } from "@/lib/board/boardTypes";

export function AnnouncementCard({ a, nowMs }: { a: AnnouncementView; nowMs: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(!a.read); // unread opens expanded
  const [read, setRead] = useState(a.read);
  const [acked, setAcked] = useState(a.acked);
  const [pending, start] = useTransition();

  const expand = () => {
    const next = !open;
    setOpen(next);
    if (next && !read) {
      setRead(true);
      start(async () => { await markAnnouncementRead(a.id); router.refresh(); });
    }
  };

  const confirm = () =>
    start(async () => {
      const r = await ackAnnouncement(a.id);
      if (r.ok) { setAcked(true); setRead(true); router.refresh(); }
    });

  return (
    <div
      className="overflow-hidden rounded-3xl border bg-[var(--color-surface)]/70 backdrop-blur transition-colors"
      style={{ borderColor: !read ? "var(--color-accent)" : "var(--color-border)" }}
    >
      <button onClick={expand} className="flex w-full items-start gap-3 p-4 text-left">
        {!read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-accent)]" aria-label="Da leggere" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {a.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />}
            <span className={`truncate text-[15px] ${!read ? "font-bold" : "font-semibold"}`}>{a.title}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
            <span>{a.authorName}{a.authorRole ? ` · ${a.authorRole}` : ""}</span>
            <span>·</span>
            <span>{relativeTime(a.createdAt, nowMs)}</span>
            <span className="rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide">{a.audienceLabel}</span>
          </div>
          {!open && <p className="mt-1 truncate text-xs text-[var(--color-muted)]">{a.body}</p>}
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-fg)]/90">{a.body}</p>

          {a.requireAck && (
            acked ? (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--color-accent)]">
                <Check className="h-3.5 w-3.5" /> Lettura confermata
              </div>
            ) : (
              <button
                disabled={pending}
                onClick={confirm}
                className="mt-3 w-full rounded-2xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-[#0a0c10] disabled:opacity-50"
              >
                {pending ? "…" : "Confermo la lettura"}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

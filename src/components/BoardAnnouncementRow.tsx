"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pin, Trash2, Eye, CheckCircle2 } from "lucide-react";
import { togglePinAnnouncement, deleteAnnouncement } from "@/app/board-actions";
import { relativeTime, type ReceiptStat } from "@/lib/board/boardTypes";

export function BoardAnnouncementRow({ a, nowMs }: { a: ReceiptStat; nowMs: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const readPct = a.audienceSize ? Math.round((a.readCount / a.audienceSize) * 100) : 0;
  const ackPct = a.audienceSize ? Math.round((a.ackCount / a.audienceSize) * 100) : 0;

  const pin = () => start(async () => { await togglePinAnnouncement(a.id); router.refresh(); });
  const remove = () => start(async () => { await deleteAnnouncement(a.id); router.refresh(); });

  return (
    <div className="card p-5" style={a.pinned ? { borderColor: "var(--color-accent)" } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {a.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />}
            <h3 className="truncate font-semibold">{a.title}</h3>
            <span className="shrink-0 rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{a.audienceLabel}</span>
            {a.requireAck && <span className="shrink-0 rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">Conferma richiesta</span>}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{a.authorName}{a.authorRole ? ` · ${a.authorRole}` : ""} · {relativeTime(a.createdAt, nowMs)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={pin} disabled={pending} title={a.pinned ? "Sblocca" : "Fissa in alto"}
            className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]" style={a.pinned ? { color: "var(--color-accent)" } : undefined}>
            <Pin className="h-4 w-4" />
          </button>
          {confirming ? (
            <span className="flex items-center gap-1">
              <button onClick={remove} disabled={pending} className="rounded-md bg-[#ef5f6b] px-2 py-1 text-[11px] font-semibold text-white">Elimina</button>
              <button onClick={() => setConfirming(false)} className="text-[11px] text-[var(--color-muted)]">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirming(true)} disabled={pending} title="Elimina"
              className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[#ef5f6b]">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-fg)]/85">{a.body}</p>

      {/* Read / ack progress — Teamworks' "seen by" made concrete */}
      <div className="mt-4 space-y-2">
        <ReceiptBar icon={<Eye className="h-3.5 w-3.5" />} label="Letto" count={a.readCount} total={a.audienceSize} pct={readPct} color="var(--color-accent)" />
        {a.requireAck && (
          <ReceiptBar icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Confermato" count={a.ackCount} total={a.audienceSize} pct={ackPct} color="#3ecf8e" />
        )}
      </div>
    </div>
  );
}

function ReceiptBar({ icon, label, count, total, pct, color }: { icon: React.ReactNode; label: string; count: number; total: number; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1 text-[var(--color-muted)]">{icon}{label}</span>
        <span className="num font-medium">{count}/{total} · {pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

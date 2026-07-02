"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Pin, CheckCircle2 } from "lucide-react";
import { postAnnouncement } from "@/app/board-actions";

// Staff composer for a Bacheca announcement. Whole-academy or one group,
// optionally pinned and/or requiring an athlete read-acknowledgement.
export function BoardComposer({ groups }: { groups: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "group">("all");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [pinned, setPinned] = useState(false);
  const [requireAck, setRequireAck] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reset = () => { setTitle(""); setBody(""); setAudience("all"); setPinned(false); setRequireAck(false); setErr(null); };

  const submit = () =>
    start(async () => {
      setErr(null);
      const r = await postAnnouncement({ title, body, audience, groupId: audience === "group" ? groupId : null, pinned, requireAck });
      if (r.ok) { reset(); setOpen(false); router.refresh(); } else setErr(r.error);
    });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
        <Megaphone className="h-4 w-4" /> Nuova comunicazione
      </button>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-[var(--color-accent)]" />
        <h2 className="text-sm font-semibold">Nuova comunicazione</h2>
      </div>

      <div className="space-y-3">
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo (es. Ritrovo domani ore 8:00)"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} placeholder="Messaggio…" rows={4}
          className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--color-muted)]">Destinatari:</span>
          <button onClick={() => setAudience("all")} className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={audience === "all" ? { background: "var(--color-accent)", color: "#0a0c10", borderColor: "var(--color-accent)" } : { borderColor: "var(--color-border)", color: "var(--color-muted)" }}>
            Tutta l&apos;academy
          </button>
          {groups.length > 0 && (
            <button onClick={() => setAudience("group")} className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              style={audience === "group" ? { background: "var(--color-accent)", color: "#0a0c10", borderColor: "var(--color-accent)" } : { borderColor: "var(--color-border)", color: "var(--color-muted)" }}>
              Un gruppo
            </button>
          )}
          {audience === "group" && groups.length > 0 && (
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs outline-none">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-[var(--color-accent)]" />
            <Pin className="h-3.5 w-3.5" /> Fissa in alto
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
            <input type="checkbox" checked={requireAck} onChange={(e) => setRequireAck(e.target.checked)} className="accent-[var(--color-accent)]" />
            <CheckCircle2 className="h-3.5 w-3.5" /> Richiedi conferma di lettura
          </label>
        </div>

        {err && <p className="text-xs text-[#f87171]">{err}</p>}

        <div className="flex items-center gap-2">
          <button disabled={pending || !title.trim() || !body.trim()} onClick={submit} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
            {pending ? "Pubblico…" : "Pubblica"}
          </button>
          <button onClick={() => { reset(); setOpen(false); }} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]">Annulla</button>
        </div>
      </div>
    </div>
  );
}

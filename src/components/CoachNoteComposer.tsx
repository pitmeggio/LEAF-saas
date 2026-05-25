"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCoachNote } from "@/app/coach-notes-actions";

// Free-text composer for the Adaptive Coach Notes engine.
// The coach writes naturally — no fixed form. They can hint a kind
// (training / race / match…), paste links to scouting sheets, and submit.
// AI structuring runs server-side via the action.

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Auto-detect kind" },
  { value: "training_session", label: "Training session" },
  { value: "race", label: "Race" },
  { value: "match", label: "Match" },
  { value: "video_review", label: "Video review" },
  { value: "physical_block", label: "Physical block" },
  { value: "testing", label: "Testing session" },
  { value: "other", label: "Other" },
];

type Attachment = { filename: string; url: string };

export function CoachNoteComposer({ athleteId, sport, placeholder }: { athleteId: string; sport: string; placeholder?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rawText, setRawText] = useState("");
  const [kind, setKind] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const canSubmit = rawText.trim().length >= 3 && !pending;

  function addAttachment() {
    const url = linkUrl.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setError("Enter a valid URL.");
      return;
    }
    setAttachments((prev) => [...prev, { filename: linkName.trim() || url.split("/").pop() || "Link", url }]);
    setLinkUrl("");
    setLinkName("");
    setError(null);
  }

  function removeAttachment(i: number) {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit() {
    setError(null);
    setOk(false);
    start(async () => {
      const res = await createCoachNote({
        athleteId,
        rawText: rawText.trim(),
        kind: kind ? (kind as Parameters<typeof createCoachNote>[0]["kind"]) : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRawText("");
      setKind("");
      setAttachments([]);
      setOk(true);
      router.refresh();
    });
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
        <h3 className="text-sm font-semibold">New coach note</h3>
        <span className="ml-auto text-[11px] text-[var(--color-muted)]">Sport context: <span className="font-medium uppercase">{sport}</span></span>
      </div>
      <p className="mb-3 text-xs text-[var(--color-muted)]">
        Write naturally — the AI reads your note, detects the themes (technical, tactical, physical, mental, race / match, injury…) and structures it dynamically. Your raw words are always saved.
      </p>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={6}
        placeholder={placeholder ?? "Write naturally — what happened, what stood out, what needs work."}
        className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm leading-relaxed focus:border-[var(--color-accent)] focus:outline-none"
      />
      <div className="mt-1 text-[10px] text-[var(--color-muted)]">{rawText.length}/8000 characters</div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          Kind:
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs focus:border-[var(--color-accent)] focus:outline-none"
          >
            {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
      </div>

      {/* Attachments — paste-link MVP. Real upload to Supabase Storage lands next. */}
      <div className="mt-4 border-t border-[var(--color-border)] pt-3">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Attachments (paste link)</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Label (optional)"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs focus:border-[var(--color-accent)] focus:outline-none"
            style={{ width: 160 }}
          />
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://… (Drive / report / video)"
            className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs focus:border-[var(--color-accent)] focus:outline-none"
            style={{ minWidth: 220 }}
          />
          <button
            type="button"
            onClick={addAttachment}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium hover:bg-[var(--color-surface-2)]"
          >
            + Add
          </button>
        </div>
        {attachments.length > 0 && (
          <ul className="mt-2 space-y-1">
            {attachments.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <a href={a.url} target="_blank" rel="noopener" className="truncate text-[var(--color-accent)] hover:underline">{a.filename}</a>
                <button type="button" onClick={() => removeAttachment(i)} className="text-[var(--color-muted)] hover:text-[#f87171]">remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-3">
        {error && <span className="text-xs text-[#f87171]">{error}</span>}
        {ok && !error && <span className="text-xs text-[var(--color-accent)]">Saved — AI structured it.</span>}
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
        >
          {pending ? "Structuring…" : "Save & structure"}
        </button>
      </div>
    </div>
  );
}

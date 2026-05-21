"use client";

import { useState } from "react";

// Gives the academy a copy-paste "Apply with LEAF" button + link to put on their
// own website. Clicking it opens LEAF's apply page for this academy (our portal),
// where the athlete applies with a verified profile — and it lands in their portal.
export function ApplyWithLeafEmbed({ applyUrl }: { applyUrl: string }) {
  const snippet = `<a href="${applyUrl}" style="display:inline-flex;align-items:center;gap:8px;background:#7CFF6B;color:#0a0c10;font:600 15px system-ui,sans-serif;padding:12px 20px;border-radius:12px;text-decoration:none">▸ Apply with LEAF</a>`;

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold">Apply with LEAF — put it on your website</h3>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Add this button to your own site. Applicants click it, apply through LEAF with a verified profile, and land straight in your portal — already scored and group-matched. No forms to triage.
      </p>

      {/* Live preview */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-[var(--color-muted)]">Preview:</span>
        <span className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold" style={{ background: "#7CFF6B", color: "#0a0c10" }}>▸ Apply with LEAF</span>
      </div>

      <CopyRow label="Direct link" value={applyUrl} />
      <CopyRow label="HTML button (paste into your site)" value={snippet} mono />
    </div>
  );
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div className="mt-4">
      <div className="mb-1 text-xs font-medium text-[var(--color-muted)]">{label}</div>
      <div className="flex items-stretch gap-2">
        <code className={`min-w-0 flex-1 truncate rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs ${mono ? "font-mono" : ""}`}>{value}</code>
        <button onClick={copy} className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium hover:border-[var(--color-accent)]">
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

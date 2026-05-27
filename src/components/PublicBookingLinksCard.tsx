"use client";

import { useState } from "react";

// Share/embed surface for the two public booking flows. Marius pastes
// these URLs (or the iframe snippet) on Trysil's own site so visitors
// reach LEAF without ever knowing it's there. The card lives on top of
// the line schedule because that's where Marius is when he's setting
// up the academy — and the moment he sees the empty grid he asks
// "how do clubs book this?"
//
// "Copy" buttons are intentional zero-step UX: no /share/embed page,
// no docs. The Trysil demo proves it works the moment he pastes.
export function PublicBookingLinksCard({ slug }: { slug: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const ptUrl = `${origin}/academy/${slug}/book/pay-and-train`;
  const lineUrl = `${origin}/academy/${slug}/book/line`;
  const landingUrl = `${origin}/academy/${slug}/book`;
  const embed = `<iframe src="${landingUrl}" style="border:0;width:100%;min-height:720px" loading="lazy" title="Book on LEAF"></iframe>`;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Public booking links</h3>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Paste these on your own website. Bookings made through them land here automatically — no email tag.
          </p>
        </div>
        <span className="kicker">Share with the world</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <LinkRow
          label="Pay-and-Train (parents)"
          description="Pre-listed sessions with your in-house coach."
          url={ptUrl}
        />
        <LinkRow
          label="Line booking (visiting clubs)"
          description="External coaches self-serve from your weekly grid."
          url={lineUrl}
        />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Embed on your site</div>
            <div className="mt-1 text-xs text-[var(--color-muted)]">
              Drop this iframe in your website&apos;s HTML — both flows show in one widget.
            </div>
          </div>
          <CopyButton text={embed} label="Copy embed" />
        </div>
        <pre className="mt-2 overflow-x-auto rounded bg-[var(--color-bg)] p-2 font-mono text-[10px] text-[var(--color-fg)]/80">
          {embed}
        </pre>
      </div>
    </div>
  );
}

function LinkRow({ label, description, url }: { label: string; description: string; url: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{description}</div>
      <div className="mt-2 flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 font-mono text-[11px]"
        />
        <CopyButton text={url} label="Copy" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-[var(--color-border)] px-2 py-1.5 text-[11px] font-medium hover:bg-[var(--color-bg)]"
        >
          Open
        </a>
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked — fallback would be to select-all the input */
        }
      }}
      className="whitespace-nowrap rounded border border-[#7CFF6B40] bg-[#7cff6b12] px-2 py-1.5 text-[11px] font-medium text-[var(--color-accent)] hover:bg-[#7cff6b22]"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

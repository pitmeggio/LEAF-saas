"use client";

import { useState } from "react";

// Copy a shareable link to the clipboard (falls back to the current page URL).
export function ShareButton({ url, label = "Share", className }: { url?: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const value = url ?? (typeof window !== "undefined" ? window.location.href : "");
    try {
      if (navigator.share && url) {
        await navigator.share({ url: value });
        return;
      }
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* user cancelled or unsupported */ }
  };
  return (
    <button
      onClick={copy}
      className={className ?? "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:border-[var(--color-accent)]"}
    >
      {copied ? "Link copied ✓" : `↗ ${label}`}
    </button>
  );
}

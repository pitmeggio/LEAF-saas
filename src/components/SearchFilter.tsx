"use client";

import { useState } from "react";
import { Search } from "lucide-react";

// Lightweight client-side search for server-rendered anagrafica lists. The list
// container carries id={targetId} and each item a data-name attribute (lowercased
// name/CF/tessera); typing filters items by toggling display. No data duplication
// across the server/client boundary — it just reads the DOM the server produced.
export function SearchFilter({ targetId, placeholder = "Cerca per nome…", className }: { targetId: string; placeholder?: string; className?: string }) {
  const [q, setQ] = useState("");

  const onChange = (v: string) => {
    setQ(v);
    const root = document.getElementById(targetId);
    if (!root) return;
    const needle = v.trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll<HTMLElement>("[data-name]").forEach((el) => {
      const hay = el.getAttribute("data-name") || "";
      const match = !needle || hay.includes(needle);
      el.style.display = match ? "" : "none";
      if (match) shown++;
    });
    // Toggle an optional "no results" element.
    const empty = document.getElementById(`${targetId}-empty`);
    if (empty) empty.style.display = shown === 0 && needle ? "" : "none";
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
      <input
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-accent)]"
      />
    </div>
  );
}

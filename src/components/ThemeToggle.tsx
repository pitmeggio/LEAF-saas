"use client";

import { useEffect, useState } from "react";

// "double colour" toggle — academies that prefer a corporate look swap from
// the default leaf-green palette into a restrained black/navy/white one
// (see :root[data-theme="navy"] in globals.css). Preference is per-browser,
// stored in localStorage and stamped before React hydrates by the inline
// script in app/layout.tsx so the swap doesn't flash on first paint.
export function ThemeToggle() {
  const [theme, setTheme] = useState<"leaf" | "navy">("leaf");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("leaf-theme");
      if (stored === "navy") setTheme("navy");
    } catch {
      /* localStorage blocked — fall back to default theme */
    }
  }, []);

  const flip = (next: "leaf" | "navy") => {
    setTheme(next);
    try {
      localStorage.setItem("leaf-theme", next);
    } catch {
      /* no-op */
    }
    // Reflect immediately on <html> so the page re-paints with the new
    // tokens without waiting for the next navigation.
    if (next === "leaf") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", "navy");
  };

  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-0.5 text-[10px]">
      <button
        type="button"
        onClick={() => flip("leaf")}
        className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
          theme === "leaf" ? "bg-[var(--color-accent)] text-[#0a0c10]" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        }`}
        title="Default leaf-green palette"
      >
        Leaf
      </button>
      <button
        type="button"
        onClick={() => flip("navy")}
        className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
          theme === "navy" ? "bg-white text-[#0a0c10]" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        }`}
        title="Black / navy / white corporate palette"
      >
        Navy
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

// Apple-style appearance toggle — single icon button at the top of the
// sidebar. Shows the SUN when the app is in light mode and the MOON when
// in dark mode; clicking flips. Preference is per-browser, stored in
// localStorage and stamped on <html> by the inline script in app/layout.tsx
// so the swap doesn't flash on first paint. Default = dark.
export function ThemeToggle() {
  const [mode, setMode] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("leaf-mode");
      if (stored === "light") setMode("light");
    } catch {
      /* localStorage blocked — keep default dark */
    }
  }, []);

  const flip = () => {
    const next: "dark" | "light" = mode === "dark" ? "light" : "dark";
    setMode(next);
    try {
      localStorage.setItem("leaf-mode", next);
    } catch {
      /* no-op */
    }
    // Reflect immediately on <html> so the page re-paints with the new
    // tokens without waiting for the next navigation.
    if (next === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
  };

  const isDark = mode === "dark";
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[12px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.93 19.07 1.41-1.41" />
      <path d="m17.66 6.34 1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

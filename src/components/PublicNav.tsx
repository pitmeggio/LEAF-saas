"use client";

import { useState } from "react";
import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";

// Shared header across the public Leaf portal (landing, explore, academy, athlete).
// Ties the otherwise-separate public pages into one navigable product.
export function PublicNav({ active }: { active?: "athletes" | "academies" }) {
  const [open, setOpen] = useState(false);
  const signInHref = active === "academies" ? "/login" : "/login/athlete";

  const links = (
    <>
      <Link
        href="/explore"
        onClick={() => setOpen(false)}
        className={`rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface)] ${active === "athletes" ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]"}`}
      >
        For athletes
      </Link>
      <Link
        href="/request"
        onClick={() => setOpen(false)}
        className={`rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface)] ${active === "academies" ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]"}`}
      >
        For academies
      </Link>
      <Link href={signInHref} onClick={() => setOpen(false)} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-center text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
        Sign in
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur">
      <div className="flex items-center justify-between px-5 py-3.5 md:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <LeafMark size={28} />
          <span className="text-lg font-bold tracking-tight">LEAF</span>
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-1 sm:flex sm:gap-2">{links}</nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-fg)] sm:hidden"
        >
          <span className="block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="flex flex-col gap-1 border-t border-[var(--color-border)] px-5 py-3 sm:hidden">{links}</nav>
      )}
    </header>
  );
}

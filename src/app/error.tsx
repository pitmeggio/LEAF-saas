"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";

// Catches unexpected runtime errors in any segment without its own boundary —
// e.g. a live FIS lookup or DB read that throws. Keeps the user on a branded
// page with a way to retry or get back, instead of a raw crash screen.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 text-center">
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute left-1/2 top-[20%] h-[320px] w-[520px] -translate-x-1/2 glow-accent" />

      <div className="relative">
        <LeafMark size={44} />
        <h1 className="display mt-8 text-2xl font-bold md:text-3xl">Something went sideways.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-[var(--color-muted)]">
          We hit an unexpected error loading this page. It&apos;s usually temporary — try again, or head back.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-[var(--color-muted)]/70">Reference: <span className="num">{error.digest}</span></p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button onClick={reset} className="rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
            Try again
          </button>
          <Link href="/" className="rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-medium hover:border-[var(--color-accent)]">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

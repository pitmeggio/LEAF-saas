import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";

// Shared header across the public Leaf portal (landing, explore, academy, athlete).
// Ties the otherwise-separate public pages into one navigable product.
export function PublicNav({ active }: { active?: "athletes" | "academies" }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-5 py-3.5 backdrop-blur md:px-12">
      <Link href="/" className="flex items-center gap-2.5">
        <LeafMark size={28} />
        <span className="text-lg font-bold tracking-tight">LEAF</span>
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/explore"
          className={`rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface)] ${active === "athletes" ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]"}`}
        >
          For athletes
        </Link>
        <Link
          href="/request"
          className={`rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface)] ${active === "academies" ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]"}`}
        >
          For academies
        </Link>
        <Link href="/login" className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
          Sign in
        </Link>
      </nav>
    </header>
  );
}

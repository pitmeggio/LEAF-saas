import { LeafMark } from "@/components/LeafMark";

// Shown while the athlete workspace loads (profile + AI forecast computation).
export default function Loading() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-5 py-3.5 backdrop-blur md:px-12">
        <div className="flex items-center gap-2.5">
          <LeafMark size={26} />
          <div className="leading-tight">
            <div className="text-sm font-bold">LEAF</div>
            <div className="text-[11px] text-[var(--color-muted)]">My profile</div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-10 px-5 py-10 md:px-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-[var(--color-surface-2)]" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-surface-2)]" />
            <div className="h-9 w-56 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
            <div className="h-4 w-72 animate-pulse rounded bg-[var(--color-surface-2)]" />
          </div>
        </div>
        <div className="h-40 animate-pulse rounded-xl bg-[var(--color-surface-2)]" />
        <div className="h-32 animate-pulse rounded-xl bg-[var(--color-surface-2)]" />
      </div>
    </div>
  );
}

import { PublicNav } from "@/components/PublicNav";

// Shown while the verified profile resolves (DB + live FIS lookup can take a moment).
export default function Loading() {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-4xl px-5 pt-12 pb-10 md:px-12">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="h-28 w-28 shrink-0 animate-pulse rounded-2xl bg-[var(--color-surface-2)]" />
            <div className="flex-1 space-y-3">
              <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-surface-2)]" />
              <div className="h-9 w-64 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
              <div className="h-4 w-48 animate-pulse rounded bg-[var(--color-surface-2)]" />
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--color-surface-2)]" />
            ))}
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-12 md:px-12">
        <div className="h-5 w-40 animate-pulse rounded bg-[var(--color-surface-2)]" />
        <div className="h-48 animate-pulse rounded-xl bg-[var(--color-surface-2)]" />
        <div className="h-32 animate-pulse rounded-xl bg-[var(--color-surface-2)]" />
      </div>
    </div>
  );
}

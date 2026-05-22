// Shown while any dashboard page loads its tenant-scoped data.
export default function Loading() {
  return (
    <div className="px-6 py-8 md:px-10">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-28 animate-pulse rounded bg-[var(--color-surface-2)]" />
        <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--color-surface-2)]" />
        ))}
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-xl bg-[var(--color-surface-2)] lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-xl bg-[var(--color-surface-2)]" />
      </div>
    </div>
  );
}

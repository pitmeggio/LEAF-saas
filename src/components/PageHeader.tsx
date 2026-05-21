export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-8 py-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="h-7 w-1 rounded-full" style={{ background: "var(--color-accent)" }} />
        <div>
          <h1 className="display text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-[var(--color-muted)]">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

import Link from "next/link";

export function StatCard({
  label,
  value,
  hint,
  accent,
  danger,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  danger?: boolean;
  href?: string;
}) {
  const color = danger ? "#f87171" : accent ? "var(--color-accent)" : undefined;
  const body = (
    <>
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="mt-2 num text-2xl font-bold lg:text-3xl" style={{ color }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--color-muted)]">{hint}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card block p-5 transition-colors hover:border-[var(--color-accent)]/50">
        {body}
      </Link>
    );
  }
  return <div className="card p-5">{body}</div>;
}

export function PercentBar({ value, color = "var(--color-accent)" }: { value: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </div>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />;
}

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  accent,
  danger,
  href,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  danger?: boolean;
  href?: string;
  icon?: LucideIcon;
}) {
  const color = danger ? "#f87171" : accent ? "var(--color-accent)" : undefined;
  const body = (
    <>
      {(accent || danger) && (
        <span className="absolute inset-x-0 top-0 h-[2px] rounded-t-[14px]" style={{ background: color, opacity: 0.85 }} />
      )}
      {Icon && (
        <span
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] transition-colors group-hover:border-[var(--color-accent)]"
          style={{ color: color ?? "var(--color-muted)" }}
        >
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <div className="kicker" style={{ paddingRight: Icon ? 40 : undefined }}>{label}</div>
      <div className="mt-2.5 num text-3xl font-bold tracking-tight" style={{ color }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--color-muted)]">{hint}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card card-hover group relative block p-5">
        {body}
      </Link>
    );
  }
  return <div className="card group relative p-5">{body}</div>;
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

import { initials, STATUS_COLOR, STATUS_LABEL, type Status, type Trend } from "@/lib/domain";

export function Avatar({
  first,
  last,
  color,
  size = 40,
}: {
  first: string;
  last: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}, ${color}aa)`,
        color: "#0a0c10",
        fontSize: size * 0.4,
      }}
    >
      {initials(first, last).toUpperCase()}
    </div>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `${c}1a`, color: c, border: `1px solid ${c}40` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-muted)] border border-[var(--color-border)]">
      {children}
    </span>
  );
}

export function TrendArrow({ trend, showPct = true }: { trend: Trend; showPct?: boolean }) {
  const map = {
    up: { c: "#7cff6b", a: "▲", label: "improving" },
    down: { c: "#f87171", a: "▼", label: "declining" },
    flat: { c: "#8a93a6", a: "▬", label: "stable" },
  } as const;
  const m = map[trend.direction];
  return (
    <span className="inline-flex items-center gap-1 num text-sm font-semibold" style={{ color: m.c }} title={m.label}>
      <span style={{ fontSize: 10 }}>{m.a}</span>
      {showPct ? `${Math.abs(trend.pct)}%` : `${trend.deltaPoints > 0 ? "−" : "+"}${Math.abs(trend.deltaPoints)}`}
    </span>
  );
}

export function ScorePill({ score }: { score: number }) {
  const c = score >= 75 ? "#7cff6b" : score >= 55 ? "#f59e0b" : "#8a93a6";
  return (
    <span className="num inline-flex items-center gap-1 text-xs font-semibold" style={{ color: c }}>
      <span className="h-2 w-2 rounded-sm" style={{ background: c }} />
      {score}
    </span>
  );
}

export function Verified() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: "#7cff6b1a", color: "#7cff6b", border: "1px solid #7cff6b40" }}
      title="FIS-verified profile"
    >
      ✓ FIS
    </span>
  );
}

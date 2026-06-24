import type { LucideIcon } from "lucide-react";

export type PulseStatus = "good" | "watch" | "bad";

const STATUS_COLOR: Record<PulseStatus, string> = {
  good: "var(--color-accent)",
  watch: "#f59e0b",
  bad: "#f87171",
};

// A small radial progress ring — the academy "pulse". Pure SVG, no client
// JS, renders identically in light/dark (track uses a surface var, the arc
// uses the status colour). Convention: the ring fills toward "good", so a
// fuller ring always reads as healthier, and the colour reinforces it.
export function PulseGauge({
  value,
  status,
  center,
  label,
  sub,
  icon: Icon,
}: {
  value: number; // 0–100 fill
  status: PulseStatus;
  center: string;
  label: string;
  sub?: string;
  icon?: LucideIcon;
}) {
  const v = Math.max(0, Math.min(100, value));
  const size = 78;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  const color = STATUS_COLOR[status];
  return (
    <div className="flex flex-col items-center gap-2.5 text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {Icon && <Icon className="mb-0.5 h-3.5 w-3.5" style={{ color }} aria-hidden />}
          <span className="num text-[15px] font-bold leading-none" style={{ color }}>{center}</span>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold">{label}</div>
        {sub && <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{sub}</div>}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

// Season Arc — custom SVG. 12 months on the x-axis, a flowing curve as the
// backbone of the year, training-phase color bands as background ribbons,
// tournament nodes plotted on the curve sized by tier (ITF/OPEN biggest,
// CAT smaller). Hover any node → side panel.
//
// Crucially: no library. Pure SVG so we own every pixel. Recharts wouldn't
// give us the breathing curve + ribbons + nodes + hover lift in one canvas.

const MONTHS_IT = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];

const PHASE_COLOR: Record<string, string> = {
  "Preparazione Invernale": "#a3b3ff",
  "TEST": "#67e8f9",
  "Consolidamento": "#7cff6b",
  "Mantenimento ": "#facc15",
  "Mantenimento": "#facc15",
  "Recovery": "#fb7185",
};

const CATEGORY_TIER: Record<string, { size: number; color: string; rank: number }> = {
  ITF: { size: 9, color: "#7cff6b", rank: 1 },
  OPEN: { size: 8, color: "#7cff6b", rank: 1 },
  RODEO_OPEN: { size: 6, color: "#38bdf8", rank: 2 },
  RODEO: { size: 6, color: "#38bdf8", rank: 2 },
  CAT_2: { size: 5.5, color: "#a78bfa", rank: 3 },
  CAT_2_3: { size: 5.5, color: "#a78bfa", rank: 3 },
  CAT_3: { size: 5, color: "#a78bfa", rank: 3 },
  CAT_3_4: { size: 5, color: "#a78bfa", rank: 3 },
  CAT_4: { size: 4.5, color: "#a78bfa", rank: 3 },
  ETA: { size: 7, color: "#7cff6b", rank: 1 },
  YOUTH: { size: 4, color: "#fb7185", rank: 4 },
  U12_14: { size: 4, color: "#fb7185", rank: 4 },
  TEAM: { size: 5, color: "#facc15", rank: 3 },
  TEAM_D1: { size: 5.5, color: "#facc15", rank: 3 },
  ALT: { size: 3, color: "#94a3b8", rank: 5 },
};

type ArcEntry = {
  id: string;
  monthIdx: number;          // 0..12 fractional
  columnKey: string;
  label: string;
  location: string | null;
  status: string;
};

type PhaseBand = { startMonth: number; endMonth: number; phase: string };

export function SeasonArc({
  entries,
  phaseBands,
  accentHex,
}: {
  entries: ArcEntry[];
  phaseBands: PhaseBand[];
  accentHex: string;
}) {
  const [hover, setHover] = useState<ArcEntry | null>(null);

  // Layout constants. Width is responsive via viewBox.
  const W = 1280;
  const H = 280;
  const PAD_X = 60;
  const PAD_TOP = 60;
  const ARC_Y_TOP = 110;
  const ARC_Y_BOTTOM = 200;

  const xFor = (m: number) => PAD_X + (m / 12) * (W - 2 * PAD_X);

  // Build the spine curve — gentle wave from Jan to Dec.
  const spinePath = useMemo(() => {
    const points: { x: number; y: number }[] = [];
    for (let m = 0; m <= 12; m += 0.5) {
      const x = xFor(m);
      // sine wave + small amplitude so the curve feels alive but readable
      const y = ARC_Y_TOP + (ARC_Y_BOTTOM - ARC_Y_TOP) / 2 + Math.sin((m / 12) * Math.PI * 2) * 18;
      points.push({ x, y });
    }
    // Smooth cubic-Bezier path
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      d += ` Q ${p1.x} ${p1.y} ${cx} ${cy}`;
    }
    const last = points[points.length - 1];
    d += ` T ${last.x} ${last.y}`;
    return d;
  }, []);

  // Plot tournament nodes. Place them slightly above/below the spine so
  // they form a pearl-necklace effect rather than a strict scatter.
  const nodes = useMemo(() => {
    return entries
      .filter((e) => e.monthIdx >= 0 && e.monthIdx <= 12)
      .map((e, i) => {
        const x = xFor(e.monthIdx);
        // y on the spine sine
        const spineY = ARC_Y_TOP + (ARC_Y_BOTTOM - ARC_Y_TOP) / 2 + Math.sin((e.monthIdx / 12) * Math.PI * 2) * 18;
        // offset above/below alternating with category rank so high-tier
        // (ITF/OPEN) stay above the line and visible
        const tier = CATEGORY_TIER[e.columnKey] ?? { size: 4, color: "#94a3b8", rank: 5 };
        const direction = tier.rank <= 2 ? -1 : (i % 2 === 0 ? 1 : -1);
        const offset = tier.rank <= 2 ? 22 + tier.size : 14 + tier.size * 0.6;
        const y = spineY + direction * offset;
        return { e, x, y, size: tier.size, color: tier.color, tier };
      });
  }, [entries]);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
        <defs>
          {/* Gradient for the spine — academy accent → cyan */}
          <linearGradient id="spineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accentHex} stopOpacity="0.4" />
            <stop offset="50%" stopColor={accentHex} stopOpacity="0.95" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
          </linearGradient>
          <filter id="spineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Phase ribbons — soft horizontal bands under the spine */}
        {phaseBands.map((b, i) => {
          const x1 = xFor(b.startMonth);
          const x2 = xFor(b.endMonth);
          const color = PHASE_COLOR[b.phase] ?? "#94a3b8";
          return (
            <rect
              key={i}
              x={x1}
              y={ARC_Y_TOP - 28}
              width={Math.max(2, x2 - x1)}
              height={(ARC_Y_BOTTOM - ARC_Y_TOP) + 56}
              fill={color}
              opacity={0.07}
              rx={12}
            />
          );
        })}

        {/* Month grid + labels */}
        {MONTHS_IT.map((m, i) => {
          const x = xFor(i + 0.5);
          return (
            <g key={i}>
              <line x1={xFor(i)} x2={xFor(i)} y1={PAD_TOP - 10} y2={H - 30} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              <text x={x} y={H - 12} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.45)" style={{ letterSpacing: "0.15em" }}>{m}</text>
            </g>
          );
        })}
        {/* final right border */}
        <line x1={xFor(12)} x2={xFor(12)} y1={PAD_TOP - 10} y2={H - 30} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />

        {/* Spine glow underlay */}
        <path d={spinePath} stroke={accentHex} strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.15" filter="url(#spineGlow)" />
        {/* Main spine */}
        <path d={spinePath} stroke="url(#spineGrad)" strokeWidth="2.5" strokeLinecap="round" fill="none" filter="url(#spineGlow)" />

        {/* Nodes */}
        {nodes.map(({ e, x, y, size, color }) => {
          const isHover = hover?.id === e.id;
          return (
            <g
              key={e.id}
              onMouseEnter={() => setHover(e)}
              onMouseLeave={() => setHover((h) => (h?.id === e.id ? null : h))}
              className="cursor-pointer"
            >
              {/* Hover glow ring */}
              {isHover && (
                <circle cx={x} cy={y} r={size + 6} fill="none" stroke={color} strokeWidth="1" opacity="0.4" />
              )}
              <circle
                cx={x}
                cy={y}
                r={size}
                fill={color}
                opacity={e.status === "played" ? 1 : e.status === "withdrawn" ? 0.25 : 0.85}
                filter="url(#nodeGlow)"
              />
              {/* tiny stem connecting node to spine for clarity */}
              <line
                x1={x}
                y1={y}
                x2={x}
                y2={ARC_Y_TOP + (ARC_Y_BOTTOM - ARC_Y_TOP) / 2 + Math.sin((e.monthIdx / 12) * Math.PI * 2) * 18}
                stroke={color}
                strokeWidth="0.6"
                opacity="0.25"
              />
            </g>
          );
        })}
      </svg>

      {/* Hover detail — micro-card */}
      {hover && (
        <div
          className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-2xl border border-[var(--color-border)] bg-[#0c0e14]/95 px-4 py-2.5 text-xs backdrop-blur"
          style={{ minWidth: 220, boxShadow: "0 12px 60px rgba(0,0,0,0.6)" }}
        >
          <div className="kicker mb-0.5" style={{ color: CATEGORY_TIER[hover.columnKey]?.color ?? "#94a3b8" }}>
            {hover.columnKey}
          </div>
          <div className="font-semibold leading-tight text-[var(--color-fg)]">{hover.label}</div>
          {hover.location && <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{hover.location}</div>}
        </div>
      )}
    </div>
  );
}

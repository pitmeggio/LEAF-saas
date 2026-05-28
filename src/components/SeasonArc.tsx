"use client";

import { useMemo, useState } from "react";

// Season Arc v2 — readable at a glance.
//
// v1 was a beautiful spine curve but you needed to hover every node to know
// what category it was. This pass turns the arc into a vertically-stacked
// constellation: each tournament tier has its own horizontal lane, so the
// eye scans one row to see "all ITF of the year". A bold phase band lives
// above the lanes and shows periodization with labels. A "today" line
// drops a vertical accent so Max instantly sees where the season is.
//
// Still 100% custom SVG, still no chart lib, still alive (gradients +
// glow). Just intuitive instead of mysterious.

const MONTHS_IT = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];

const PHASE_COLOR: Record<string, string> = {
  "Preparazione Invernale": "#a3b3ff",
  "TEST": "#67e8f9",
  "Consolidamento": "#7cff6b",
  "Mantenimento ": "#facc15",
  "Mantenimento": "#facc15",
  "Recovery": "#fb7185",
};

const PHASE_LABEL: Record<string, string> = {
  "Preparazione Invernale": "Preparazione",
  "TEST": "Test",
  "Consolidamento": "Consolidamento",
  "Mantenimento ": "Mantenimento",
  "Mantenimento": "Mantenimento",
  "Recovery": "Recovery",
};

// Tier groups — each group becomes ONE horizontal lane in the chart. Order
// matters: top to bottom = priority. Max scans "ITF row" or "category row"
// without thinking.
const TIER_GROUPS: { key: string; label: string; categories: string[]; color: string; size: number }[] = [
  { key: "elite", label: "ITF · OPEN · ETA", categories: ["ITF", "OPEN", "ETA"], color: "#7cff6b", size: 7.5 },
  { key: "rodeo", label: "Rodeo", categories: ["RODEO_OPEN", "RODEO"], color: "#38bdf8", size: 6 },
  { key: "cat", label: "Categoria FIT", categories: ["CAT_2", "CAT_2_3", "CAT_3", "CAT_3_4", "CAT_4"], color: "#a78bfa", size: 5.5 },
  { key: "team", label: "Squadre", categories: ["TEAM", "TEAM_D1"], color: "#facc15", size: 5 },
  { key: "youth", label: "Youth · alternative", categories: ["YOUTH", "U12_14", "ALT"], color: "#fb7185", size: 4.5 },
];

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

  // Layout — width is responsive via viewBox.
  const W = 1280;
  const PAD_X = 90;             // room for left lane labels
  const PAD_RIGHT = 30;
  const PHASE_Y = 14;
  const PHASE_H = 28;
  const LANES_TOP = 64;
  const LANE_H = 42;
  const LANE_COUNT = TIER_GROUPS.length;
  const H = LANES_TOP + LANE_COUNT * LANE_H + 32;
  const xFor = (m: number) => PAD_X + (m / 12) * (W - PAD_X - PAD_RIGHT);

  // Today indicator (only when 'now' lies inside the season window the page
  // is rendering for — best-effort by mapping today's date onto a 0-12 axis
  // anchored on Jan 1 of the same year as the data).
  const todayMonth = useMemo(() => {
    const d = new Date();
    return d.getMonth() + (d.getDate() - 1) / 31;
  }, []);

  // Group entries by tier-lane and stagger horizontally when two tournaments
  // fall on the same month to avoid overlap.
  const nodesByLane = useMemo(() => {
    const lanes: { lane: typeof TIER_GROUPS[0]; entries: ArcEntry[] }[] = TIER_GROUPS.map((l) => ({ lane: l, entries: [] }));
    for (const e of entries) {
      const idx = TIER_GROUPS.findIndex((t) => t.categories.includes(e.columnKey));
      if (idx >= 0) lanes[idx].entries.push(e);
    }
    return lanes;
  }, [entries]);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
        <defs>
          {/* Phase band gradient — each phase fades into the next */}
          <linearGradient id="phaseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
          <filter id="nodeGlowV2" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Phase band — STRONG. Tall enough to label, opacity high enough to read. */}
        {phaseBands.map((b, i) => {
          const x1 = xFor(b.startMonth);
          const x2 = xFor(b.endMonth);
          const color = PHASE_COLOR[b.phase] ?? "#94a3b8";
          const label = PHASE_LABEL[b.phase] ?? b.phase;
          const width = Math.max(2, x2 - x1);
          const showLabel = width > 60;
          return (
            <g key={i}>
              <rect
                x={x1}
                y={PHASE_Y}
                width={width}
                height={PHASE_H}
                fill={color}
                opacity={0.18}
                rx={5}
              />
              <rect
                x={x1}
                y={PHASE_Y + PHASE_H - 2.5}
                width={width}
                height={2.5}
                fill={color}
                opacity={0.55}
              />
              {showLabel && (
                <text
                  x={x1 + width / 2}
                  y={PHASE_Y + PHASE_H / 2 + 3.5}
                  textAnchor="middle"
                  fontSize="10"
                  fill={color}
                  style={{ letterSpacing: "0.12em", fontWeight: 600 }}
                >
                  {label.toUpperCase()}
                </text>
              )}
            </g>
          );
        })}

        {/* Month grid + labels */}
        {MONTHS_IT.map((m, i) => {
          const x = xFor(i + 0.5);
          const xStart = xFor(i);
          return (
            <g key={i}>
              <line x1={xStart} x2={xStart} y1={PHASE_Y + PHASE_H + 6} y2={H - 28} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              <text
                x={x}
                y={LANES_TOP - 8}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(255,255,255,0.5)"
                style={{ letterSpacing: "0.2em", fontWeight: 600 }}
              >
                {m}
              </text>
            </g>
          );
        })}
        <line x1={xFor(12)} x2={xFor(12)} y1={PHASE_Y + PHASE_H + 6} y2={H - 28} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />

        {/* Today indicator — vertical accent line */}
        {todayMonth >= 0 && todayMonth <= 12 && (
          <g>
            <line
              x1={xFor(todayMonth)}
              x2={xFor(todayMonth)}
              y1={LANES_TOP - 14}
              y2={H - 26}
              stroke={accentHex}
              strokeWidth="1.4"
              strokeDasharray="3 3"
              opacity="0.7"
            />
            <text
              x={xFor(todayMonth)}
              y={LANES_TOP - 18}
              textAnchor="middle"
              fontSize="9"
              fill={accentHex}
              style={{ letterSpacing: "0.18em", fontWeight: 600 }}
            >
              OGGI
            </text>
          </g>
        )}

        {/* Lanes */}
        {nodesByLane.map(({ lane, entries: laneEntries }, laneIdx) => {
          const y = LANES_TOP + laneIdx * LANE_H + LANE_H / 2 + 6;
          // Stagger entries that share the same month using a tiny y-offset.
          const monthBuckets = new Map<number, ArcEntry[]>();
          for (const e of laneEntries) {
            const k = Math.round(e.monthIdx * 4); // quarter-month buckets
            const bucket = monthBuckets.get(k) ?? [];
            bucket.push(e);
            monthBuckets.set(k, bucket);
          }
          return (
            <g key={lane.key}>
              {/* Lane background row */}
              <rect
                x={PAD_X}
                y={y - LANE_H / 2 + 4}
                width={W - PAD_X - PAD_RIGHT}
                height={LANE_H - 8}
                fill={lane.color}
                opacity="0.03"
                rx="6"
              />
              {/* Lane left label */}
              <text x={PAD_X - 12} y={y - 4} textAnchor="end" fontSize="9" fill={lane.color} style={{ letterSpacing: "0.18em", fontWeight: 600 }}>
                {lane.label.split(" · ")[0].toUpperCase()}
              </text>
              <text x={PAD_X - 12} y={y + 8} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.35)" style={{ letterSpacing: "0.12em" }}>
                {laneEntries.length} · {lane.label.split(" · ").slice(1).join(" · ").toUpperCase() || "EVENTI"}
              </text>
              {/* Lane spine — subtle horizontal hairline */}
              <line
                x1={xFor(0)}
                x2={xFor(12)}
                y1={y}
                y2={y}
                stroke={lane.color}
                strokeWidth="0.6"
                opacity="0.18"
              />
              {/* Nodes — staggered to avoid collisions */}
              {[...monthBuckets.entries()].flatMap(([_, bucket]) =>
                bucket.map((e, i) => {
                  const x = xFor(Math.max(0, Math.min(12, e.monthIdx)));
                  const offset = bucket.length > 1 ? (i - (bucket.length - 1) / 2) * 5 : 0;
                  const isHover = hover?.id === e.id;
                  const r = lane.size + (isHover ? 1.5 : 0);
                  return (
                    <g
                      key={e.id}
                      onMouseEnter={() => setHover(e)}
                      onMouseLeave={() => setHover((h) => (h?.id === e.id ? null : h))}
                      className="cursor-pointer"
                    >
                      {isHover && (
                        <circle cx={x} cy={y + offset} r={r + 6} fill="none" stroke={lane.color} strokeWidth="1" opacity="0.5" />
                      )}
                      <circle
                        cx={x}
                        cy={y + offset}
                        r={r}
                        fill={lane.color}
                        opacity={e.status === "played" ? 1 : e.status === "withdrawn" ? 0.25 : 0.9}
                        filter="url(#nodeGlowV2)"
                      />
                    </g>
                  );
                }),
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover detail card — sticky in the top-center of the chart */}
      {hover && (
        <div
          className="pointer-events-none absolute left-1/2 -top-3 -translate-x-1/2 rounded-2xl border border-[var(--color-border)] bg-[#0c0e14]/95 px-4 py-2.5 text-xs backdrop-blur"
          style={{ minWidth: 240, boxShadow: "0 12px 60px rgba(0,0,0,0.6)" }}
        >
          <div className="kicker mb-0.5" style={{ color: tierColorFor(hover.columnKey) }}>
            {hover.columnKey}
          </div>
          <div className="font-semibold leading-tight text-[var(--color-fg)]">{hover.label}</div>
          {hover.location && <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{hover.location}</div>}
        </div>
      )}
    </div>
  );
}

function tierColorFor(category: string): string {
  for (const t of TIER_GROUPS) {
    if (t.categories.includes(category)) return t.color;
  }
  return "#94a3b8";
}

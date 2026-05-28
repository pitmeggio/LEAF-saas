"use client";

import { useState } from "react";
import Link from "next/link";

// Cross-athlete swim-lane SVG. One horizontal row per athlete, 12-month
// x-axis. Tournament nodes coloured by category. Clash columns (3+
// athletes on same weekend) drawn as red vertical stripes behind the
// lanes — Max sees the problem before he sees the tournaments.

const MONTHS_IT = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];

const CATEGORY_COLOR: Record<string, string> = {
  ITF: "#7cff6b", OPEN: "#7cff6b", ETA: "#7cff6b",
  RODEO_OPEN: "#38bdf8", RODEO: "#38bdf8",
  CAT_2: "#a78bfa", CAT_2_3: "#a78bfa", CAT_3: "#a78bfa", CAT_3_4: "#a78bfa", CAT_4: "#a78bfa",
  YOUTH: "#fb7185", U12_14: "#fb7185",
  TEAM: "#facc15", TEAM_D1: "#facc15",
  ALT: "#94a3b8",
};

const CATEGORY_SIZE: Record<string, number> = {
  ITF: 7, OPEN: 6.5, ETA: 6, RODEO_OPEN: 5.5, RODEO: 5.5,
  CAT_2: 5, CAT_2_3: 5, CAT_3: 4.5, CAT_3_4: 4.5, CAT_4: 4,
  YOUTH: 4, U12_14: 4, TEAM: 4.5, TEAM_D1: 5, ALT: 3,
};

type LaneEntry = {
  id: string;
  monthIdx: number;
  weekStart: string;
  columnKey: string;
  label: string;
  location: string | null;
  status: string;
  trainingPhase: string | null;
};

type Lane = {
  athleteId: string;
  displayName: string;
  age: number;
  total: number;
  byCategory: Record<string, number>;
  topCategory: string | null;
  entries: LaneEntry[];
};

type Clash = {
  monthIdx: number;
  weekStart: string;
  count: number;
  athleteNames: string[];
};

type LoadCell = { weekIso: string; monthIdx: number; total: number };

export function SeasonLanes({
  lanes,
  clashes,
  weekLoad,
  accentHex,
}: {
  lanes: Lane[];
  clashes: Clash[];
  weekLoad: LoadCell[];
  accentHex: string;
}) {
  const [hover, setHover] = useState<{ athlete: string; e: LaneEntry } | null>(null);

  if (lanes.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-muted)]">
        Nessun piano stagionale ancora. Importa il calendario tornei per popolare la season view.
      </div>
    );
  }

  const W = 1400;
  const LANE_H = 48;
  const PAD_LEFT = 200;
  const PAD_RIGHT = 30;
  const PAD_TOP = 60;       // for month axis + load sparkline
  const H = PAD_TOP + lanes.length * LANE_H + 30;
  const xFor = (m: number) => PAD_LEFT + (m / 12) * (W - PAD_LEFT - PAD_RIGHT);
  const maxLoad = Math.max(1, ...weekLoad.map((w) => w.total));

  // Load sparkline path — area chart of week totals along the top.
  const loadAreaPath = (() => {
    if (weekLoad.length === 0) return "";
    let d = `M ${xFor(weekLoad[0].monthIdx)} 50`;
    for (const w of weekLoad) {
      const x = xFor(w.monthIdx);
      const y = 50 - (w.total / maxLoad) * 28;
      d += ` L ${x} ${y}`;
    }
    d += ` L ${xFor(12)} 50 Z`;
    return d;
  })();
  const loadStrokePath = (() => {
    if (weekLoad.length === 0) return "";
    let d = `M ${xFor(weekLoad[0].monthIdx)} 50`;
    for (const w of weekLoad) {
      const x = xFor(w.monthIdx);
      const y = 50 - (w.total / maxLoad) * 28;
      d += ` L ${x} ${y}`;
    }
    return d;
  })();

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
        <defs>
          <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentHex} stopOpacity="0.5" />
            <stop offset="100%" stopColor={accentHex} stopOpacity="0.05" />
          </linearGradient>
          <filter id="laneGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Clash bands — red vertical stripes spanning all lanes */}
        {clashes.map((c, i) => (
          <rect
            key={i}
            x={xFor(c.monthIdx) - 14}
            y={PAD_TOP - 6}
            width={28}
            height={lanes.length * LANE_H + 12}
            fill="#fb7185"
            opacity={c.count >= 4 ? 0.16 : 0.08}
            rx={6}
          />
        ))}

        {/* Month grid + labels */}
        {MONTHS_IT.map((m, i) => (
          <g key={i}>
            <line x1={xFor(i)} x2={xFor(i)} y1={20} y2={H - 14} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            <text x={xFor(i + 0.5)} y={H - 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)" style={{ letterSpacing: "0.15em" }}>{m}</text>
          </g>
        ))}
        <line x1={xFor(12)} x2={xFor(12)} y1={20} y2={H - 14} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />

        {/* Load sparkline top — academy-wide weekly entry count */}
        <text x={PAD_LEFT - 10} y={28} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.4)" style={{ letterSpacing: "0.18em" }}>LOAD / WEEK</text>
        <path d={loadAreaPath} fill="url(#loadGrad)" />
        <path d={loadStrokePath} stroke={accentHex} strokeWidth="1.4" fill="none" opacity="0.9" />

        {/* Lanes */}
        {lanes.map((lane, laneIdx) => {
          const y = PAD_TOP + laneIdx * LANE_H + LANE_H / 2;
          return (
            <g key={lane.athleteId}>
              {/* Athlete label on the left */}
              <text x={PAD_LEFT - 14} y={y - 4} textAnchor="end" fontSize="13" fontWeight="600" fill="rgba(255,255,255,0.92)">
                {lane.displayName}
              </text>
              <text x={PAD_LEFT - 14} y={y + 9} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.45)" style={{ letterSpacing: "0.1em" }}>
                {lane.age}y · {lane.total} eventi · {lane.topCategory ?? "—"}
              </text>
              {/* Lane spine line */}
              <line
                x1={xFor(0)}
                x2={xFor(12)}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
              {/* Entry nodes */}
              {lane.entries.map((e) => {
                const x = xFor(Math.max(0, Math.min(12, e.monthIdx)));
                const r = CATEGORY_SIZE[e.columnKey] ?? 4;
                const color = CATEGORY_COLOR[e.columnKey] ?? "#94a3b8";
                const isHover = hover?.e.id === e.id;
                return (
                  <g
                    key={e.id}
                    onMouseEnter={() => setHover({ athlete: lane.displayName, e })}
                    onMouseLeave={() => setHover((h) => (h?.e.id === e.id ? null : h))}
                    className="cursor-pointer"
                  >
                    {isHover && <circle cx={x} cy={y} r={r + 5} fill="none" stroke={color} strokeWidth="1" opacity="0.5" />}
                    <circle
                      cx={x}
                      cy={y}
                      r={r}
                      fill={color}
                      opacity={e.status === "withdrawn" ? 0.25 : 0.9}
                      filter="url(#laneGlow)"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-2xl border border-[var(--color-border)] bg-[#0c0e14]/95 px-4 py-2.5 text-xs backdrop-blur"
          style={{ minWidth: 240, boxShadow: "0 12px 60px rgba(0,0,0,0.6)" }}
        >
          <div className="kicker mb-0.5" style={{ color: CATEGORY_COLOR[hover.e.columnKey] ?? "#94a3b8" }}>
            {hover.athlete} · {hover.e.columnKey}
          </div>
          <div className="font-semibold leading-tight text-[var(--color-fg)]">{hover.e.label}</div>
          {hover.e.location && <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{hover.e.location}</div>}
          {hover.e.trainingPhase && <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{hover.e.trainingPhase}</div>}
        </div>
      )}
    </div>
  );
}

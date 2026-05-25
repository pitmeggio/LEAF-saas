import { TrendArrow } from "@/components/ui";
import { fmtPoints } from "@/lib/domain";
import type { Trend } from "@/lib/domain";

// Renders a single sport-specific cell in the Athletes list. Keeps the
// data-coupling here so the page stays a clean composition: it asks the
// active sport module for its columns, then for each column asks this
// renderer to draw the value. New sports add cases here.

export type AthleteForCell = {
  fisPoints: number | null;
  worldRank?: number | null;
  playingStyle?: string | null;
  technicalLevel?: number | null;
  tacticalLevel?: number | null;
  physicalLevel?: number | null;
  mentalLevel?: number | null;
  discipline?: string;
};

export function AthleteSportCell({ field, athlete, trend }: {
  field: string;
  athlete: AthleteForCell;
  trend: Trend;
}) {
  switch (field) {
    // ── Universal / cross-sport ─────────────────────────────────────────
    case "trend":
      return <TrendArrow trend={trend} />;

    // ── Ski ─────────────────────────────────────────────────────────────
    case "fisPoints":
      return <span className="num">{fmtPoints(athlete.fisPoints)}</span>;
    case "worldRank":
      return <span className="num">{athlete.worldRank ?? "—"}</span>;

    // ── Tennis ──────────────────────────────────────────────────────────
    case "playingStyle":
      return <span className="text-xs text-[var(--color-muted)]">{athlete.playingStyle || "—"}</span>;
    case "tennisLevels":
      return <TennisLevels athlete={athlete} />;
    case "tennisWinRate":
    case "tennisRecentForm":
      // Need aggregated match data — added in a follow-up commit.
      return <span className="text-xs text-[var(--color-muted)]">—</span>;

    default:
      return <span className="text-xs text-[var(--color-muted)]">—</span>;
  }
}

// Compact "T/T/P/M" badge — small enough to fit in a list cell, colour-codes
// the average so the coach spots strong and weak athletes at a glance.
function TennisLevels({ athlete }: { athlete: AthleteForCell }) {
  const vals = [athlete.technicalLevel, athlete.tacticalLevel, athlete.physicalLevel, athlete.mentalLevel];
  const present = vals.filter((v): v is number => typeof v === "number");
  if (present.length === 0) return <span className="text-xs text-[var(--color-muted)]">—</span>;
  const avg = present.reduce((s, v) => s + v, 0) / present.length;
  const color = avg >= 8 ? "var(--color-accent)" : avg >= 5 ? "#7CFF6B" : "#f59e0b";
  return (
    <span className="num inline-flex items-center gap-1 text-xs">
      {vals.map((v, i) => (
        <span
          key={i}
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-semibold"
          style={{
            background: typeof v === "number" ? `${color}22` : "var(--color-surface-2)",
            color: typeof v === "number" ? color : "var(--color-muted)",
          }}
        >
          {v ?? "—"}
        </span>
      ))}
    </span>
  );
}

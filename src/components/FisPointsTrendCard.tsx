"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { syncAthleteFisHistory } from "@/app/fis-history-actions";
import type { DisciplinePointsTrend } from "@/lib/ai/pointsTrend";

// Per-discipline FIS points trend, fed by FisListSnapshot rows synced from
// the live FIS export. Each row shows: current points, world rank, delta
// across the window, and an arrow indicating the trend direction.
//
// The card always tells the truth about its data source: it shows the
// "as of" date of the most recent snapshot and a Sync button that hits
// the official FIS list again. When there is no data yet, the card is a
// CTA to sync — no fake numbers, no placeholders.
//
// FIS points are LOWER = BETTER, so a negative delta is improvement and
// renders green; positive delta renders red.

type Props = {
  athleteId: string;
  trends: DisciplinePointsTrend[];
  lastSyncedAt: Date | null;       // most recent FisListSnapshot.syncedAt
  lastPublishedAt: Date | null;    // most recent FIS list publication date
  // When false, the Sync button is hidden (e.g. coach view, simulated mode).
  canSync: boolean;
};

const TREND_BADGE: Record<DisciplinePointsTrend["trend"], { label: string; color: string; bg: string }> = {
  improving: { label: "Improving", color: "var(--color-accent)", bg: "#7cff6b18" },
  declining: { label: "Declining", color: "#f87171", bg: "#f8717118" },
  stable: { label: "Stable", color: "var(--color-muted)", bg: "rgba(255,255,255,0.04)" },
  insufficient_data: { label: "Single snapshot", color: "#f59e0b", bg: "#f59e0b18" },
};

export function FisPointsTrendCard({ athleteId, trends, lastSyncedAt, lastPublishedAt, canSync }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSync = () => {
    setErr(null);
    setMsg(null);
    start(async () => {
      const r = await syncAthleteFisHistory(athleteId, 22);
      if (r.ok) {
        setMsg(`Synced ${r.snapshotsAdded} snapshots from ${r.listsRead} FIS list${r.listsRead === 1 ? "" : "s"}.`);
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  };

  return (
    <div className="card p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>FIS</span>
            <h3 className="text-sm font-semibold">FIS points trend</h3>
          </div>
          <p className="text-[11px] text-[var(--color-muted)]">
            Per-discipline trend across the last FIS points lists. Live data from <span className="num">fis-ski.com</span> — never fabricated.
          </p>
        </div>
        {canSync && (
          <button
            type="button"
            onClick={onSync}
            disabled={pending}
            className="shrink-0 rounded-lg border border-[#7CFF6B40] bg-[#7cff6b12] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] disabled:opacity-50"
          >
            {pending ? "Syncing…" : trends.length === 0 ? "Sync from FIS" : "Re-sync"}
          </button>
        )}
      </div>

      {trends.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-muted)]">
          No FIS history synced yet. {canSync ? "Click “Sync from FIS” to pull this athlete's points across the last 4 lists (≈ 2 months)." : "Ask an admin to sync this athlete from FIS."}
        </div>
      ) : (
        <div className="space-y-3">
          {trends.map((t) => {
            const badge = TREND_BADGE[t.trend];
            const deltaSign = t.delta < 0 ? "−" : t.delta > 0 ? "+" : "±";
            const deltaAbs = Math.abs(t.delta).toFixed(1);
            const deltaColor = t.delta < 0 ? "var(--color-accent)" : t.delta > 0 ? "#f87171" : "var(--color-muted)";
            return (
              <div key={t.discipline} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="num text-right text-sm">
                    <span className="font-semibold">{t.current.toFixed(1)}</span>
                    <span className="ml-1 text-[10px] text-[var(--color-muted)]">FIS pts</span>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-3 text-[11px]">
                  <Field label="Δ pts" value={`${deltaSign}${deltaAbs}`} color={deltaColor} />
                  <Field
                    label="World rank"
                    value={t.worldRankCurrent != null ? String(t.worldRankCurrent) : "—"}
                  />
                  <Field
                    label="Δ rank"
                    value={
                      t.rankDelta == null
                        ? "—"
                        : `${t.rankDelta > 0 ? "+" : t.rankDelta < 0 ? "−" : "±"}${Math.abs(t.rankDelta)}`
                    }
                    color={
                      t.rankDelta == null
                        ? undefined
                        : t.rankDelta < 0
                          ? "var(--color-accent)"   // rank dropped (better)
                          : t.rankDelta > 0
                            ? "#f87171"             // rank climbed (worse)
                            : "var(--color-muted)"
                    }
                  />
                  <Field label="Snapshots" value={String(t.sampleSize)} />
                </div>
                {t.series.length > 1 && (
                  <Sparkline series={t.series} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-[10px] text-[var(--color-muted)]">
        <span>
          {lastPublishedAt ? `As of ${lastPublishedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` : "No snapshot yet"}
        </span>
        <span>
          {lastSyncedAt ? `Synced ${timeAgo(lastSyncedAt)}` : ""}
        </span>
      </div>

      {(msg || err) && (
        <div className="mt-2 text-[11px]">
          {err ? <span className="text-[#f87171]">{err}</span> : <span className="text-[var(--color-accent)]">{msg}</span>}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="num mt-0.5 text-xs" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

// Tiny SVG sparkline of the points series. Lower = better, so we DON'T
// invert the y-axis here — the visual instinct of "going down means doing
// better" matches FIS reality and is intuitive to coaches looking at FIS.
function Sparkline({ series }: { series: { date: Date; fisPoints: number }[] }) {
  if (series.length < 2) return null;
  const W = 200;
  const H = 36;
  const pts = series.map((s) => s.fisPoints);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const stepX = W / (series.length - 1);
  const path = series
    .map((s, i) => {
      const x = i * stepX;
      const y = H - ((s.fisPoints - min) / range) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
    </svg>
  );
}

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

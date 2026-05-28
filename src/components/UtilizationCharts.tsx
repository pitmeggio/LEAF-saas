"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import type { UtilizationReport } from "@/lib/utilization";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = [8, 9, 11, 13, 15, 18];   // peaks of the canonical slot windows

// Renders three views together because Marius will read them as one story:
//   1. Annual bookings flow (monthly stacked bar) — long-term picture.
//   2. Last-12-weeks trend (line + areas) — short-term momentum.
//   3. Day × hour heatmap — where the demand actually concentrates.
//   4. Leaderboards (top lines / top customers / top clubs).
export function UtilizationCharts({ report, currency }: { report: UtilizationReport; currency: string }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Annual flow */}
        <div className="card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-semibold">Annual bookings flow</h3>
              <p className="text-[11px] text-[var(--color-muted)]">Stacked monthly — internal team · Pay-and-Train · visiting clubs.</p>
            </div>
          </div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={report.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fill: "var(--color-muted)", fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="internal" stackId="a" name="Team" fill="#f59e0b" />
                <Bar dataKey="payAndTrain" stackId="a" name="Pay-and-Train" fill="#38bdf8" />
                <Bar dataKey="externalClub" stackId="a" name="Visiting clubs" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* P&T revenue trend (monthly) */}
        <div className="card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-semibold">Pay-and-Train revenue · monthly</h3>
              <p className="text-[11px] text-[var(--color-muted)]">Cumulative revenue from public sessions.</p>
            </div>
          </div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={report.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fill: "var(--color-muted)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--color-muted)", fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => `${currency} ${Number(v ?? 0).toLocaleString("en-US")}`}
                  contentStyle={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="revenue" name="P&T revenue" stroke="#7cff6b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Last 12 weeks trend */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h3 className="text-sm font-semibold">Recent 12 weeks · affluenza</h3>
              <p className="text-[11px] text-[var(--color-muted)]">Short-term momentum — how booking volume is moving week-to-week.</p>
            </div>
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={report.weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="weekLabel" tick={{ fill: "var(--color-muted)", fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="internal" stackId="w" name="Team" fill="#f59e0b" />
                <Bar dataKey="payAndTrain" stackId="w" name="Pay-and-Train" fill="#38bdf8" />
                <Bar dataKey="externalClub" stackId="w" name="Visiting clubs" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Day × hour heatmap */}
      <div className="card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h3 className="text-sm font-semibold">When the slopes get used</h3>
            <p className="text-[11px] text-[var(--color-muted)]">Demand heatmap — darker = busier. Day on the left, slot at the top.</p>
          </div>
        </div>
        <Heatmap data={report.heatmap} />
      </div>

      {/* Leaderboards: top lines / top customers / top clubs */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Leaderboard
          title="Busiest lines"
          subtitle="Which line your customers ask for the most."
          rows={report.topLines.map((l) => ({
            label: `${l.slopeName} · L${l.lineLabel}`,
            value: `${l.bookings} bookings`,
            sub: `${Math.round(l.utilization * 100)}% utilized`,
          }))}
          empty="No bookings yet."
        />
        <Leaderboard
          title="Top Pay-and-Train customers"
          subtitle="Loyal P&T parents and athletes."
          rows={report.topCustomers.map((c) => ({
            label: c.name,
            value: `${c.bookings} sessions`,
            sub: c.spent > 0 ? `${currency} ${c.spent.toLocaleString("en-US")}` : undefined,
          }))}
          empty="No Pay-and-Train customers yet."
        />
        <Leaderboard
          title="Visiting clubs"
          subtitle="External clubs renting your lines."
          rows={report.topClubs.map((c) => ({
            label: c.org,
            value: `${c.bookings} line bookings`,
          }))}
          empty="No external clubs have booked yet."
        />
      </div>
    </>
  );
}

function Leaderboard({
  title,
  subtitle,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  rows: { label: string; value: string; sub?: string }[];
  empty: string;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[11px] text-[var(--color-muted)]">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-[var(--color-muted)]">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 border-b border-[var(--color-border)]/50 pb-2 last:border-b-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.label}</div>
                {r.sub && <div className="text-[10px] text-[var(--color-muted)]">{r.sub}</div>}
              </div>
              <div className="text-xs font-semibold tabular-nums" style={{ color: "var(--color-accent)" }}>
                {r.value}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Heatmap({ data }: { data: { dayIdx: number; hour: number; count: number }[] }) {
  // Normalise to [0..1] for color intensity. Empty cells render as a faint
  // outline rather than nothing, so the grid is always visible.
  const max = Math.max(1, ...data.map((d) => d.count));
  const lookup = new Map(data.map((d) => [`${d.dayIdx}|${d.hour}`, d.count]));
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-1 text-[10px]">
        <thead>
          <tr>
            <th />
            {HOURS.map((h) => (
              <th key={h} className="px-2 py-1 text-center font-medium text-[var(--color-muted)]">
                {String(h).padStart(2, "0")}:00
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAY_LABELS.map((dayLabel, dayIdx) => (
            <tr key={dayLabel}>
              <td className="px-2 py-1 text-right font-medium text-[var(--color-muted)]">{dayLabel}</td>
              {HOURS.map((h) => {
                const count = lookup.get(`${dayIdx}|${h}`) ?? 0;
                const alpha = count === 0 ? 0 : 0.18 + (count / max) * 0.7;
                return (
                  <td key={h} className="p-0">
                    <div
                      className="flex h-9 min-w-[3.5rem] items-center justify-center rounded text-[10px] font-semibold"
                      style={{
                        background: count === 0 ? "transparent" : `rgba(124, 255, 107, ${alpha})`,
                        border: count === 0 ? "1px dashed var(--color-border)" : "1px solid rgba(124, 255, 107, 0.4)",
                        color: count > 0 ? "#0a0c10" : "var(--color-muted)",
                      }}
                      title={`${dayLabel} ${h}:00 — ${count} bookings`}
                    >
                      {count > 0 ? count : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

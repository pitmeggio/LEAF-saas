"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export type Point = { label: string; fisPoints: number };

export function GrowthChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7cff6b" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#7cff6b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#232834" vertical={false} />
        <XAxis dataKey="label" stroke="#8a93a6" fontSize={11} tickLine={false} axisLine={false} />
        {/* FIS points: lower is better, so invert the axis to read "up = better" */}
        <YAxis stroke="#8a93a6" fontSize={11} tickLine={false} axisLine={false} reversed width={42} />
        <Tooltip
          contentStyle={{
            background: "#12151c",
            border: "1px solid #232834",
            borderRadius: 10,
            fontSize: 12,
          }}
          labelStyle={{ color: "#8a93a6" }}
          formatter={(v: number) => [`${v} FIS pts`, "Points"]}
        />
        <Area type="monotone" dataKey="fisPoints" stroke="#7cff6b" strokeWidth={2.5} fill="url(#g)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

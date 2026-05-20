"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, TrendArrow, Verified } from "@/components/ui";
import { DISCIPLINE_LABEL, COUNTRY, fmtPoints, type Trend } from "@/lib/domain";

export type Row = {
  id: string;
  firstName: string;
  lastName: string;
  photoColor: string;
  nationality: string;
  gender: string;
  discipline: string;
  age: number;
  fisPoints: number | null;
  worldRank: number | null;
  verified: boolean;
  trend: Trend;
};

type SortKey = "fisPoints" | "trend" | "age" | "worldRank";

const selectCls =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]";

export function AthletesExplorer({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [discipline, setDiscipline] = useState("all");
  const [country, setCountry] = useState("all");
  const [gender, setGender] = useState("all");
  const [trend, setTrend] = useState("all");
  const [maxAge, setMaxAge] = useState(30);
  const [sort, setSort] = useState<SortKey>("trend");

  const disciplines = useMemo(() => [...new Set(rows.map((r) => r.discipline))], [rows]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.nationality))], [rows]);

  const filtered = useMemo(() => {
    const out = rows.filter((r) => {
      if (q && !`${r.firstName} ${r.lastName}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (discipline !== "all" && r.discipline !== discipline) return false;
      if (country !== "all" && r.nationality !== country) return false;
      if (gender !== "all" && r.gender !== gender) return false;
      if (trend !== "all" && r.trend.direction !== trend) return false;
      if (r.age > maxAge) return false;
      return true;
    });
    out.sort((a, b) => {
      if (sort === "trend") return b.trend.pct - a.trend.pct;
      if (sort === "fisPoints") return (a.fisPoints ?? Infinity) - (b.fisPoints ?? Infinity);
      if (sort === "age") return a.age - b.age;
      return (a.worldRank ?? 9999) - (b.worldRank ?? 9999);
    });
    return out;
  }, [rows, q, discipline, country, gender, trend, maxAge, sort]);

  return (
    <div className="p-8">
      {/* Filter bar */}
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search athletes…"
          className={`${selectCls} min-w-48 flex-1`}
        />
        <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className={selectCls}>
          <option value="all">All disciplines</option>
          {disciplines.map((d) => (
            <option key={d} value={d}>
              {DISCIPLINE_LABEL[d]}
            </option>
          ))}
        </select>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className={selectCls}>
          <option value="all">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {COUNTRY[c]?.flag} {COUNTRY[c]?.name ?? c}
            </option>
          ))}
        </select>
        <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectCls}>
          <option value="all">All</option>
          <option value="F">Women</option>
          <option value="M">Men</option>
        </select>
        <select value={trend} onChange={(e) => setTrend(e.target.value)} className={selectCls}>
          <option value="all">Any trend</option>
          <option value="up">Improving</option>
          <option value="flat">Stable</option>
          <option value="down">Declining</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          Age ≤
          <input
            type="range"
            min={14}
            max={30}
            value={maxAge}
            onChange={(e) => setMaxAge(Number(e.target.value))}
            className="accent-[var(--color-accent)]"
          />
          <span className="num w-6 text-[var(--color-fg)]">{maxAge}</span>
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={`${selectCls} ml-auto`}>
          <option value="trend">Sort: best trend</option>
          <option value="fisPoints">Sort: FIS points</option>
          <option value="worldRank">Sort: world rank</option>
          <option value="age">Sort: youngest</option>
        </select>
      </div>

      <div className="mb-3 text-xs text-[var(--color-muted)]">
        {filtered.length} athlete{filtered.length === 1 ? "" : "s"}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <th className="px-5 py-3 font-medium">Athlete</th>
              <th className="px-3 py-3 font-medium">Discipline</th>
              <th className="px-3 py-3 font-medium">Age</th>
              <th className="px-3 py-3 font-medium">FIS pts</th>
              <th className="px-3 py-3 font-medium">World rank</th>
              <th className="px-3 py-3 font-medium">12mo trend</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                <td className="px-5 py-3">
                  <Link href={`/athletes/${r.id}`} className="flex items-center gap-3">
                    <Avatar first={r.firstName} last={r.lastName} color={r.photoColor} size={34} />
                    <span className="flex items-center gap-2 font-medium">
                      {r.firstName} {r.lastName} {r.verified && <Verified />}
                      <span className="text-xs text-[var(--color-muted)]">{COUNTRY[r.nationality]?.flag}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-[var(--color-muted)]">{DISCIPLINE_LABEL[r.discipline]}</td>
                <td className="num px-3 py-3">{r.age}</td>
                <td className="num px-3 py-3 font-semibold">{fmtPoints(r.fisPoints)}</td>
                <td className="num px-3 py-3 text-[var(--color-muted)]">{r.worldRank ?? "—"}</td>
                <td className="px-3 py-3"><TrendArrow trend={r.trend} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">
                  No athletes match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

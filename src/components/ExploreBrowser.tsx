"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RecruitingBadge } from "@/components/Recruiting";
import { DISCIPLINE_LABEL, COUNTRY, fmtPoints } from "@/lib/domain";
import type { AcademyDirectoryCard, AthleteDirectoryCard } from "@/lib/profiles";

// Tiny inline trend line. Values are FIS points (lower = better), so a downward
// line = improving → rendered green; otherwise muted amber.
function Sparkline({ values }: { values: number[] }) {
  const w = 72, h = 22;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`)
    .join(" ");
  const improving = values[values.length - 1] <= values[0];
  const color = improving ? "#7cff6b" : "#f59e0b";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <polyline points={pts} stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

type Tab = "all" | "academies" | "athletes";

const inp =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]";

export function ExploreBrowser({
  academies,
  athletes,
}: {
  academies: AcademyDirectoryCard[];
  athletes: AthleteDirectoryCard[];
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [discipline, setDiscipline] = useState("all");
  const [recruitingOnly, setRecruitingOnly] = useState(false);

  const recruitingNow = academies.filter((a) => a.recruiting && a.recruiting !== "CLOSED").length;

  const disciplines = useMemo(
    () => Array.from(new Set(athletes.map((a) => a.discipline).filter(Boolean))).sort(),
    [athletes],
  );

  const ql = q.trim().toLowerCase();
  const filteredAcademies = useMemo(
    () =>
      academies.filter((a) => {
        if (recruitingOnly && (!a.recruiting || a.recruiting === "CLOSED")) return false;
        if (ql && !(`${a.name} ${a.location ?? ""} ${a.sport}`.toLowerCase().includes(ql))) return false;
        return true;
      }),
    [academies, ql, recruitingOnly],
  );
  const filteredAthletes = useMemo(
    () =>
      athletes.filter((a) => {
        if (discipline !== "all" && a.discipline !== discipline) return false;
        if (ql && !(`${a.firstName} ${a.lastName} ${a.academyName ?? ""}`.toLowerCase().includes(ql))) return false;
        return true;
      }),
    [athletes, ql, discipline],
  );

  const showAcademies = tab !== "athletes";
  const showAthletes = tab !== "academies";

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-12">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Explore LEAF</h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--color-muted)]">
          High-performance academies and verified athlete profiles — connected. Find an academy, open its athletes, dive into performance analytics.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Chip label="Academies" value={academies.length} />
          <Chip label="Athletes" value={athletes.length} />
          <Chip label="Recruiting now" value={recruitingNow} accent />
        </div>
      </div>

      {/* Controls */}
      <div className="sticky top-[57px] z-20 -mx-5 mb-8 border-y border-[var(--color-border)] bg-[var(--color-bg)]/90 px-5 py-3 backdrop-blur md:top-[61px]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">⌕</span>
            <input className={`${inp} pl-9`} placeholder="Search academies or athletes…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-[var(--color-border)] p-0.5">
              {(["all", "academies", "athletes"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${tab === t ? "bg-[var(--color-accent)] text-[#0a0c10]" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {showAthletes && disciplines.length > 0 && (
              <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs outline-none focus:border-[var(--color-accent)]">
                <option value="all">All disciplines</option>
                {disciplines.map((d) => (
                  <option key={d} value={d}>{DISCIPLINE_LABEL[d] ?? d}</option>
                ))}
              </select>
            )}
            {showAcademies && (
              <button
                onClick={() => setRecruitingOnly((v) => !v)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${recruitingOnly ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-fg)]" : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}
              >
                ● Recruiting now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Academies */}
      {showAcademies && (
        <section className="mb-12">
          <SectionHead title="Academies" count={filteredAcademies.length} />
          {filteredAcademies.length === 0 ? (
            <Empty>No academies match your search.</Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAcademies.map((a) => (
                <Link key={a.slug} href={`/academy/${a.slug}`} className="card group p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--color-accent)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-black" style={{ background: a.logoColor, color: "#0a0c10" }}>{a.name[0]}</div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{a.name}</div>
                      <div className="truncate text-xs text-[var(--color-muted)]">{a.location ?? ""}{a.location ? " · " : ""}<span className="capitalize">{a.sport}</span></div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                    {a.recruiting ? <RecruitingBadge status={a.recruiting} size="sm" /> : <span className="text-xs text-[var(--color-muted)]">Not recruiting</span>}
                    <span className="text-xs text-[var(--color-muted)]">{a.athleteCount} athlete{a.athleteCount === 1 ? "" : "s"}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Athletes */}
      {showAthletes && (
        <section>
          <SectionHead title="Athletes" count={filteredAthletes.length} />
          {filteredAthletes.length === 0 ? (
            <Empty>No athletes match your filters.</Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAthletes.map((a) => {
                const country = COUNTRY[a.nationality];
                const initials = `${a.firstName[0] ?? ""}${a.lastName[0] ?? ""}`.toUpperCase();
                return (
                  <Link key={a.slug} href={`/athlete/${a.slug}`} className="card card-hover group p-5">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--color-border)]">
                        {a.publicPhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.publicPhotoUrl} alt={`${a.firstName} ${a.lastName}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-black" style={{ background: a.photoColor, color: "#fff" }}>{initials}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{a.firstName} {a.lastName}</span>
                          {a.verified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#7cff6b1a] px-1.5 py-0.5 text-[10px] font-semibold text-[#7cff6b]" title="Verified performance">✓</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-[var(--color-muted)]">{country?.flag} {DISCIPLINE_LABEL[a.discipline] ?? a.discipline}{a.academyName ? ` · ${a.academyName}` : ""}</div>
                      </div>
                      {a.spark && <Sparkline values={a.spark} />}
                    </div>
                    {(a.fisPoints != null || a.worldRank != null) && (
                      <div className="mt-4 flex items-center gap-5 border-t border-[var(--color-border)] pt-3">
                        <Stat label="FIS pts" value={fmtPoints(a.fisPoints)} />
                        <Stat label="World" value={a.worldRank != null ? `#${a.worldRank}` : "—"} />
                        <span className="ml-auto text-[10px] uppercase tracking-wide text-[var(--color-muted)]">View profile →</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Chip({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5">
      <span className="num text-sm font-bold" style={accent ? { color: "var(--color-accent)" } : undefined}>{value}</span>
      <span className="text-xs text-[var(--color-muted)]">{label}</span>
    </div>
  );
}

function SectionHead({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{title}</h2>
      <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] num text-[var(--color-muted)]">{count}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-10 text-center text-sm text-[var(--color-muted)]">{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="leading-tight">
      <div className="num text-sm font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

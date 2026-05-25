// Ski-academy season helpers. A season runs roughly Aug 1 (startYear) → Jul 31
// (startYear + 1) and is rendered as "YYYY/YY" (e.g. "2026/27").
// Pure + DB-free so it can be imported anywhere (client, server actions, lib).

export type Season = string;

export function formatSeason(startYear: number): Season {
  const next = (startYear + 1) % 100;
  return `${startYear}/${String(next).padStart(2, "0")}`;
}

// Which season does this date belong to?  Aug-Dec → starts this calendar year;
// Jan-Jul → started last calendar year.
export function seasonForDate(d: Date | string): Season {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  return date.getMonth() >= 7 ? formatSeason(y) : formatSeason(y - 1);
}

export function currentSeason(): Season {
  return seasonForDate(new Date());
}

// Half-open at the second extreme is friendlier for date math, but academies
// think in calendar terms, so we return an inclusive end-of-day.
export function seasonBounds(season: Season): { start: Date; end: Date } {
  const startYear = parseInt(season.split("/")[0], 10);
  return {
    start: new Date(startYear, 7, 1, 0, 0, 0, 0),               // Aug 1 startYear
    end: new Date(startYear + 1, 6, 31, 23, 59, 59, 999),       // Jul 31 startYear+1
  };
}

// 2 seasons back, current, 3 forward — covers planning + history at a glance.
export function availableSeasons(reference?: Season): Season[] {
  const ref = reference ?? currentSeason();
  const startYear = parseInt(ref.split("/")[0], 10);
  return [-2, -1, 0, 1, 2, 3].map((d) => formatSeason(startYear + d));
}

// First calendar day of a season (used to anchor the planner cursor).
export function seasonStartMonth(season: Season): Date {
  return seasonBounds(season).start;
}

// Adjacent seasons — used by Reports to compare two consecutive seasons
// without forcing the caller to do string-arithmetic on the "YYYY/YY" format.
export function previousSeason(season: Season): Season {
  const startYear = parseInt(season.split("/")[0], 10);
  return formatSeason(startYear - 1);
}
export function nextSeason(season: Season): Season {
  const startYear = parseInt(season.split("/")[0], 10);
  return formatSeason(startYear + 1);
}

// Last N seasons up to (and including) `season` — oldest first.
// Useful for short trend strips ("4-season growth").
export function trailingSeasons(season: Season, n: number): Season[] {
  const startYear = parseInt(season.split("/")[0], 10);
  const out: Season[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(formatSeason(startYear - i));
  return out;
}

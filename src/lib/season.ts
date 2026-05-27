// Ski-academy season helpers. An alpine season runs May 1 (startYear) → Apr 30
// (startYear + 1) and is rendered as "YYYY/YY" (e.g. "2026/27"). May 1 is the
// cutover because that's when alpine academies close out one season's books and
// start planning the next one — race calendar runs Nov–Apr.
// Pure + DB-free so it can be imported anywhere (client, server actions, lib).

export type Season = string;

// Month index (0-based) at which the new alpine season starts: 4 = May.
// Centralised so a future rule change (e.g. switch to August for other sports)
// is a one-line edit.
export const SEASON_START_MONTH = 4;

export function formatSeason(startYear: number): Season {
  const next = (startYear + 1) % 100;
  return `${startYear}/${String(next).padStart(2, "0")}`;
}

// Which season does this date belong to?  May-Dec → starts this calendar year;
// Jan-Apr → still inside the season that started last calendar year.
export function seasonForDate(d: Date | string): Season {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  return date.getMonth() >= SEASON_START_MONTH ? formatSeason(y) : formatSeason(y - 1);
}

export function currentSeason(): Season {
  return seasonForDate(new Date());
}

// Half-open at the second extreme is friendlier for date math, but academies
// think in calendar terms, so we return an inclusive end-of-day. Window is
// May 1 (start of new alpine season) → Apr 30 of the next calendar year.
export function seasonBounds(season: Season): { start: Date; end: Date } {
  const startYear = parseInt(season.split("/")[0], 10);
  return {
    start: new Date(startYear, SEASON_START_MONTH, 1, 0, 0, 0, 0),                    // May 1 startYear
    end: new Date(startYear + 1, SEASON_START_MONTH - 1, 30, 23, 59, 59, 999),        // Apr 30 startYear+1
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

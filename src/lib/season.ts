// Season helpers — sport-aware. Two formats coexist:
//   • Ski / alpine  → "YYYY/YY" (e.g. "2026/27"), May 1 → Apr 30. May is the
//     cutover because alpine academies close the books when the race calendar
//     (Nov–Apr) ends.
//   • Tennis / padel → calendar year "YYYY" (e.g. "2026"), Jan 1 → Dec 31.
// The stored value's shape decides the maths: a "/" means ski, otherwise
// calendar year. Callers that create a *new* season pass `calendar` explicitly.
// Pure + DB-free so it can be imported anywhere (client, server actions, lib).

export type Season = string;

// Month index (0-based) at which the new alpine season starts: 4 = May.
export const SEASON_START_MONTH = 4;

// A season string is "calendar year" (tennis) unless it carries the ski "/".
export function isCalendarSeason(s: Season): boolean {
  return !s.includes("/");
}

export function formatSeason(startYear: number, calendar = false): Season {
  if (calendar) return String(startYear);
  const next = (startYear + 1) % 100;
  return `${startYear}/${String(next).padStart(2, "0")}`;
}

// The start year encoded in a season, regardless of format ("2026" | "2026/27").
function startYearOf(season: Season): number {
  return parseInt(season.split("/")[0], 10);
}

// Which ski season does this date belong to?  May-Dec → starts this calendar
// year; Jan-Apr → still inside the season that started last calendar year.
export function seasonForDate(d: Date | string): Season {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  return date.getMonth() >= SEASON_START_MONTH ? formatSeason(y) : formatSeason(y - 1);
}

// The current season for a sport mode. Calendar (tennis) = this calendar year;
// ski = the alpine season that contains today.
export function currentSeason(calendar = false): Season {
  if (calendar) return String(new Date().getFullYear());
  return seasonForDate(new Date());
}

// Date window for a season — inclusive end-of-day. Auto-detects the format:
// calendar ("2026") → Jan 1 → Dec 31; ski ("2026/27") → May 1 → Apr 30.
export function seasonBounds(season: Season): { start: Date; end: Date } {
  const startYear = startYearOf(season);
  if (isCalendarSeason(season)) {
    return {
      start: new Date(startYear, 0, 1, 0, 0, 0, 0),
      end: new Date(startYear, 11, 31, 23, 59, 59, 999),
    };
  }
  return {
    start: new Date(startYear, SEASON_START_MONTH, 1, 0, 0, 0, 0),
    end: new Date(startYear + 1, SEASON_START_MONTH - 1, 30, 23, 59, 59, 999),
  };
}

// 2 seasons back, current, 3 forward — covers planning + history at a glance.
// Preserves the format of the reference (calendar vs ski).
export function availableSeasons(reference?: Season): Season[] {
  const ref = reference ?? currentSeason();
  const calendar = isCalendarSeason(ref);
  const startYear = startYearOf(ref);
  return [-2, -1, 0, 1, 2, 3].map((d) => formatSeason(startYear + d, calendar));
}

export function seasonStartMonth(season: Season): Date {
  return seasonBounds(season).start;
}

// Adjacent seasons — preserve the reference format.
export function previousSeason(season: Season): Season {
  return formatSeason(startYearOf(season) - 1, isCalendarSeason(season));
}
export function nextSeason(season: Season): Season {
  return formatSeason(startYearOf(season) + 1, isCalendarSeason(season));
}

// Last N seasons up to (and including) `season` — oldest first, same format.
export function trailingSeasons(season: Season, n: number): Season[] {
  const calendar = isCalendarSeason(season);
  const startYear = startYearOf(season);
  const out: Season[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(formatSeason(startYear - i, calendar));
  return out;
}

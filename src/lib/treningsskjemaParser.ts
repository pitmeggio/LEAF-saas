// Parser for Trysil's "Treningsskjema uke NN.xlsx" — the weekly line schedule
// Marius (and his coaches) hand out. Layout:
//
//   Row 1: title ("Line Schedule Trysil Race Center Høgegga")
//   Row 3: ["Week: 16", "", "L1 Skiersleft", "Slope 63", "", "", "", "", "Slope 80"]
//   Row 5: ["", "", "", "1", "2", "3", "4", "5", "1", "2", "3"]   ← line labels
//   Row 6+: [day, "13-Apr", "09:00 - 11:00", "TRA", "", "DEV GS", ...]
//
// The day name appears only on the first time-slot row for that day; the date
// column always carries the calendar date for that row.
//
// Output: a flat list of bookings (one per non-empty cell). Date carries the
// year supplied by the importer (the sheet doesn't embed one).
//
// Pure + dependency-free apart from xlsx (no DB calls); easy to test.

import * as xlsx from "xlsx";

export type ParsedBooking = {
  slopeName: string;       // "Slope 63"
  lineLabel: string;       // "1", "2", …
  startAt: Date;
  endAt: Date;
  label: string;           // "TRA", "DEV GS", …
  dayLabel: string;        // "Monday"
};

export type ParseResult = {
  weekNumber: number | null;
  weekLabel: string | null;
  bookings: ParsedBooking[];
  warnings: string[];
};

const DAY_TOKENS = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  // Norwegian (just in case)
  "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag",
]);

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDateCell(s: string, year: number): Date | null {
  // Accepts "13-Apr", "13/04", "13.04". Returns midnight UTC for that day.
  const v = (s ?? "").trim();
  if (!v) return null;
  // "13-Apr" / "13 Apr"
  const m1 = /^(\d{1,2})[-\s./](\w{3,9})$/.exec(v);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const monthKey = m1[2].slice(0, 3).toLowerCase();
    const month = MONTH_MAP[monthKey];
    if (month != null) return new Date(Date.UTC(year, month, day));
  }
  // "13/04" or "13.04"
  const m2 = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/.exec(v);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const month = parseInt(m2[2], 10) - 1;
    const y = m2[3] ? parseInt(m2[3].length === 2 ? "20" + m2[3] : m2[3], 10) : year;
    return new Date(Date.UTC(y, month, day));
  }
  return null;
}

function parseTimeRange(s: string): { startMin: number; endMin: number } | null {
  // "09:00 - 11:00" → { 9*60, 11*60 }
  const m = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/.exec(s ?? "");
  if (!m) return null;
  const startMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const endMin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

function asString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

// Walk the slope-header row and group columns by slope. Returns:
//   [{ slopeName: "Slope 63", startCol: 3, endCol: 7 }, …]
// Where startCol is the column index of the first line under that slope (inclusive).
function detectSlopeRanges(headerRow: string[]): { slopeName: string; startCol: number; endCol: number }[] {
  const out: { slopeName: string; startCol: number; endCol: number }[] = [];
  for (let c = 0; c < headerRow.length; c++) {
    const v = asString(headerRow[c]);
    if (/slope\s*\d+/i.test(v) || /piste\s*\d+/i.test(v)) {
      out.push({ slopeName: v.replace(/\s+/g, " ").trim(), startCol: c, endCol: c });
    }
  }
  if (out.length === 0) return out;
  // endCol = (next slope startCol - 1) for all but the last; last extends to last non-empty col considered
  for (let i = 0; i < out.length; i++) {
    if (i < out.length - 1) {
      out[i].endCol = out[i + 1].startCol - 1;
    } else {
      out[i].endCol = headerRow.length - 1;
    }
  }
  return out;
}

export function parseTreningsskjema(buffer: Buffer | ArrayBuffer, year: number): ParseResult {
  const wb = xlsx.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    return { weekNumber: null, weekLabel: null, bookings: [], warnings: ["No sheet in workbook."] };
  }

  const rows: string[][] = xlsx.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: "",
  }) as string[][];

  const warnings: string[] = [];

  // Find the header row containing "Week:" — gives us week number + slope columns.
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = rows[i] ?? [];
    if (r.some((c) => /week\s*:?\s*\d+/i.test(asString(c)))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx < 0) {
    return { weekNumber: null, weekLabel: null, bookings: [], warnings: ["Could not find a 'Week: NN' header row."] };
  }

  const headerRow = (rows[headerRowIdx] ?? []).map(asString);
  const weekMatch = headerRow.map((c) => /week\s*:?\s*(\d+)/i.exec(c)).find(Boolean);
  const weekNumber = weekMatch ? parseInt(weekMatch[1], 10) : null;
  const slopes = detectSlopeRanges(headerRow);
  if (slopes.length === 0) {
    return { weekNumber, weekLabel: weekNumber ? `Week ${weekNumber}` : null, bookings: [], warnings: ["No 'Slope NN' columns found in header row."] };
  }

  // Find the line-label row — the first row after the header where the slope
  // columns hold numeric labels.
  let labelRowIdx = -1;
  for (let i = headerRowIdx + 1; i < Math.min(headerRowIdx + 5, rows.length); i++) {
    const r = (rows[i] ?? []).map(asString);
    const candidate = r[slopes[0].startCol];
    if (candidate && /^\d+$/.test(candidate)) {
      labelRowIdx = i;
      break;
    }
  }
  if (labelRowIdx < 0) {
    return { weekNumber, weekLabel: weekNumber ? `Week ${weekNumber}` : null, bookings: [], warnings: ["Could not find the line-label row under the slope headers."] };
  }
  const labelRow = (rows[labelRowIdx] ?? []).map(asString);

  // For each slope, collect the line columns + labels actually present.
  const lineCols: { slopeName: string; col: number; lineLabel: string }[] = [];
  for (const slope of slopes) {
    for (let c = slope.startCol; c <= slope.endCol; c++) {
      const v = labelRow[c];
      if (v && /^[A-Za-z0-9]+$/.test(v)) {
        lineCols.push({ slopeName: slope.slopeName, col: c, lineLabel: v });
      }
    }
  }
  if (lineCols.length === 0) {
    return { weekNumber, weekLabel: weekNumber ? `Week ${weekNumber}` : null, bookings: [], warnings: ["No line columns detected under any slope."] };
  }

  // Walk day rows from labelRow + 1 to end.
  const bookings: ParsedBooking[] = [];
  let currentDayLabel = "";
  let currentDate: Date | null = null;

  for (let i = labelRowIdx + 1; i < rows.length; i++) {
    const r = (rows[i] ?? []).map(asString);

    const c0 = r[0] ?? "";
    const c1 = r[1] ?? "";
    const c2 = r[2] ?? "";

    if (DAY_TOKENS.has(c0.toLowerCase())) {
      currentDayLabel = c0;
      currentDate = parseDateCell(c1, year);
      if (!currentDate) {
        warnings.push(`Row ${i + 1}: could not parse date "${c1}".`);
      }
    }

    const timeRange = parseTimeRange(c2);
    if (!timeRange || !currentDate) continue;

    const startAt = new Date(currentDate);
    startAt.setUTCHours(0, 0, 0, 0);
    startAt.setUTCMinutes(timeRange.startMin);
    const endAt = new Date(currentDate);
    endAt.setUTCHours(0, 0, 0, 0);
    endAt.setUTCMinutes(timeRange.endMin);

    for (const lc of lineCols) {
      const cellRaw = r[lc.col] ?? "";
      const cell = cellRaw.trim();
      if (!cell || cell === "|" || cell === "-") continue;
      bookings.push({
        slopeName: lc.slopeName,
        lineLabel: lc.lineLabel,
        startAt,
        endAt,
        label: cell,
        dayLabel: currentDayLabel,
      });
    }
  }

  return {
    weekNumber,
    weekLabel: weekNumber ? `Week ${weekNumber}` : null,
    bookings,
    warnings,
  };
}

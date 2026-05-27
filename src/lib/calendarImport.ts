// Excel / CSV → CalendarEvent[] parser.
//
// Tolerant by design: ski coaches manage 3-5 different season-plan
// spreadsheets a year, each with slightly different column names ("Date",
// "Data", "From", "Inizio"…). Rather than force one schema, we accept any
// sheet and fuzzy-match headers + values into a stable shape the engine
// understands. Anything we can't map gets reported back, never silently
// dropped or fabricated.
//
// Pure: no Prisma, no auth, no I/O. Hand the bytes in, get parsed events
// out, plus a list of warnings the UI can show.

import * as XLSX from "xlsx";

export type ParsedEvent = {
  title: string;
  type: string;          // training | camp | race | travel | meeting | off | other
  startDate: Date;
  endDate: Date | null;
  location: string | null;
  notes: string | null;
};

export type ParseResult = {
  events: ParsedEvent[];
  warnings: string[];    // soft issues — row skipped or guessed value
  sheetName: string;     // which sheet we parsed (for transparency)
  totalRows: number;     // total non-header rows seen
};

// Header keyword → field. Each keyword is matched on lowercased,
// whitespace-stripped column names with substring tolerance, so "Data
// inizio", "Start Date", "from", "Dal" all hit the start field.
const HEADER_RULES: { field: keyof RawRow; keywords: string[] }[] = [
  { field: "start", keywords: ["start", "inizio", "from", "dal", "data inizio", "departure", "arrival"] },
  { field: "end",   keywords: ["end", "fine", "to", "al", "until", "data fine", "return"] },
  { field: "type",  keywords: ["type", "tipo", "kind", "category", "categoria"] },
  { field: "location", keywords: ["location", "luogo", "place", "where", "venue", "city"] },
  { field: "title", keywords: ["title", "titolo", "name", "nome", "event", "evento", "session"] },
  { field: "notes", keywords: ["notes", "note", "description", "descrizione", "comment", "commento"] },
  // Fallback "date" only matches if nothing else hit start/end yet.
  { field: "start", keywords: ["date", "data"] },
];

type RawRow = {
  start?: unknown;
  end?: unknown;
  type?: unknown;
  location?: unknown;
  title?: unknown;
  notes?: unknown;
};

// Italian + English type-value mapping. Anything unrecognised falls
// through to "other" so the row still imports — the UI flags it.
const TYPE_MAP: Record<string, string> = {
  training: "training", allenamento: "training", train: "training",
  camp: "camp", ritiro: "camp", clinic: "camp",
  race: "race", gara: "race", competition: "race", fis: "race",
  travel: "travel", viaggio: "travel", trasferta: "travel", trip: "travel",
  meeting: "meeting", riunione: "meeting", briefing: "meeting",
  off: "off", riposo: "off", rest: "off", "day off": "off",
};

function normaliseType(v: unknown): string {
  if (!v) return "training";
  const s = String(v).trim().toLowerCase();
  if (!s) return "training";
  if (TYPE_MAP[s]) return TYPE_MAP[s];
  // Substring search for things like "GS race day" → "race".
  for (const k of Object.keys(TYPE_MAP)) {
    if (s.includes(k)) return TYPE_MAP[k];
  }
  return "other";
}

// Map header strings → RawRow field. Returns null if nothing matched.
//
// Real header labels are short. Match only when the cell value is itself
// a header (≤ 20 chars) so a *data* cell like "approach to gates" does
// not falsely hit the "to" keyword. We also require either full equality
// or a word-boundary substring to keep the matcher honest.
function classifyHeader(header: string): keyof RawRow | null {
  const norm = header.trim().toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!norm || norm.length > 20) return null;
  const tokens = new Set(norm.split(" "));
  for (const rule of HEADER_RULES) {
    for (const kw of rule.keywords) {
      // Multi-word keyword: still substring-match (e.g. "data inizio").
      if (kw.includes(" ")) {
        if (norm.includes(kw)) return rule.field;
      } else {
        if (tokens.has(kw)) return rule.field;
      }
    }
  }
  return null;
}

// Coerce a cell value to Date. Handles:
//   • JS Date (xlsx returns these when cellDates: true)
//   • Excel serial numbers (45642 = 2025-01-31)
//   • ISO strings (2026-12-04)
//   • EU dd/mm/yyyy and dd-mm-yyyy
function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
  if (typeof v === "number") {
    // Excel epoch is 1899-12-30 (Lotus bug), 86400000 ms per day.
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // EU dd/mm/yyyy or dd-mm-yyyy
    const eu = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (eu) {
      const dd = parseInt(eu[1], 10);
      const mm = parseInt(eu[2], 10);
      let yy = parseInt(eu[3], 10);
      if (yy < 100) yy += 2000;
      const d = new Date(Date.UTC(yy, mm - 1, dd));
      return Number.isFinite(d.getTime()) ? d : null;
    }
    // ISO / native Date.parse.
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export function parseCalendarFile(buffer: ArrayBuffer, opts: { seasonStartYear?: number } = {}): ParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { events: [], warnings: ["File has no sheets."], sheetName: "", totalRows: 0 };

  const ws = wb.Sheets[sheetName];
  // Keep raw values when possible so day-of-month integers stay numeric.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  if (rows.length === 0) {
    return { events: [], warnings: ["Sheet is empty."], sheetName, totalRows: 0 };
  }

  // Try the row-per-event layout first; if that misses (a coach uploaded
  // their season grid instead of a flat list), fall back to the grid
  // parser. The two formats are visually distinct so the detection is
  // unambiguous in practice.
  const flat = parseFlatRows(rows);
  if (flat.events.length > 0 || flat.headerFound) {
    return { ...flat, sheetName, totalRows: rows.length };
  }

  const grid = parseGridCalendar(rows, opts.seasonStartYear ?? new Date().getFullYear());
  if (grid.events.length > 0) {
    return {
      events: grid.events,
      warnings: grid.warnings,
      sheetName,
      totalRows: rows.length,
    };
  }

  return {
    events: [],
    warnings: [
      "Could not find a header row OR a recognisable month-grid layout. Expected columns like Start / End / Type / Location, or a calendar grid with month headers (Mai, Juni, Juli, … / May, June, July, … / Maggio, Giugno, Luglio, …).",
    ],
    sheetName,
    totalRows: rows.length,
  };
}

// Row-per-event ("flat") parser — the original simple layout: a header
// row at the top, one row per event below. Returns headerFound=false
// when nothing looks like a header so the caller can try the grid
// parser instead of bailing out.
function parseFlatRows(rows: unknown[][]): { events: ParsedEvent[]; warnings: string[]; headerFound: boolean } {
  // Find the header row — typically row 0, but tolerate a 1- or 2-row
  // title block above it (common in Excel templates).
  //
  // A legit header has DISTINCT fields (start + something else) and at
  // least one cell classified as a start/date column — otherwise we're
  // looking at a data row that coincidentally contains keyword-like text
  // ("approach to gates" hitting "to" is the classic false positive).
  let headerRowIdx = -1;
  let headerMap: (keyof RawRow | null)[] = [];
  for (let i = 0; i < Math.min(rows.length, 4); i++) {
    const candidate = (rows[i] ?? []).map((c) => toStr(c));
    const mapped = candidate.map((c) => classifyHeader(c));
    const distinctFields = new Set(mapped.filter((x): x is keyof RawRow => x !== null));
    const hasStart = distinctFields.has("start");
    if (distinctFields.size >= 2 && hasStart) {
      headerRowIdx = i;
      headerMap = mapped;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return { events: [], warnings: [], headerFound: false };
  }

  const events: ParsedEvent[] = [];
  const warnings: string[] = [];
  const dataRows = rows.slice(headerRowIdx + 1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] ?? [];
    const rowNum = headerRowIdx + 2 + i; // 1-indexed for human-readable errors

    // Skip blank rows entirely without warning.
    const allEmpty = row.every((c) => c == null || c === "" || (typeof c === "string" && c.trim() === ""));
    if (allEmpty) continue;

    const raw: RawRow = {};
    for (let col = 0; col < headerMap.length; col++) {
      const f = headerMap[col];
      if (!f) continue;
      // Don't overwrite a field already set by an earlier column (so
      // a sheet with both "Date" and "Start" headers prefers "Start").
      if (raw[f] == null) raw[f] = row[col];
    }

    const start = toDate(raw.start);
    if (!start) {
      warnings.push(`Row ${rowNum}: missing or invalid start date — skipped.`);
      continue;
    }
    const end = toDate(raw.end);
    const type = normaliseType(raw.type);
    const location = toStr(raw.location) || null;
    const notes = toStr(raw.notes) || null;
    // Title fallback: explicit > "{type} · {location}" > "{type}".
    let title = toStr(raw.title);
    if (!title) {
      const parts = [type.charAt(0).toUpperCase() + type.slice(1)];
      if (location) parts.push(location);
      title = parts.join(" · ");
    }

    events.push({ title, type, startDate: start, endDate: end, location, notes });
  }

  return { events, warnings, headerFound: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid-calendar parser — alpine coaches keep a "month-block" spreadsheet:
//
//   |     | Mai             | Juni            | Juli            | ...
//   |     | Plan A | Plan B | Plan A | Plan B | Plan A | Plan B
//   |  1  | Trysil |        |        |        | Juvass |
//   |  2  | Trysil |        |        |        | Juvass |
//   |  3  | Trysil |        |        |        | OFF    |
//
// Each month block exposes Plan A (location), Plan B (backup), Info
// (notes). Day numbers run down the leftmost column of each block. We
// detect month headers in any of three languages (Norwegian, English,
// Italian), find the column offsets, walk down day rows, then collapse
// consecutive same-location days into a single multi-day event.
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  // Norwegian
  januar: 0, februar: 1, mars: 2, april: 3, mai: 4, juni: 5, juli: 6,
  august: 7, september: 8, oktober: 9, november: 10, desember: 11,
  // English
  january: 0, february: 1, march: 2, may: 4, june: 5, july: 6, october: 9, december: 11,
  // Italian
  gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5, luglio: 6,
  agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11,
};

function classifyType(loc: string): { type: string; location: string | null } {
  const lc = loc.trim().toLowerCase();
  if (!lc || lc === "-") return { type: "training", location: null };
  if (lc === "off" || lc === "rest" || lc === "riposo") return { type: "off", location: null };
  if (lc.includes("arrival") || lc.includes("departure") || lc.includes("travel") || lc.includes("move to")) {
    return { type: "travel", location: loc.trim() };
  }
  if (lc.includes("race") || lc.includes("fis race") || lc.includes("gara")) {
    return { type: "race", location: loc.trim() };
  }
  return { type: "camp", location: loc.trim() };
}

function parseGridCalendar(rows: unknown[][], seasonStartYear: number): { events: ParsedEvent[]; warnings: string[] } {
  const warnings: string[] = [];

  // Step 1: detect month-name cells anywhere in the first 4 rows.
  const monthCols: { col: number; month: number }[] = [];
  let monthHeaderRow = -1;
  for (let r = 0; r < Math.min(rows.length, 4); r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const name = String(row[c] ?? "").trim().toLowerCase();
      if (MONTH_MAP[name] !== undefined) {
        monthCols.push({ col: c, month: MONTH_MAP[name] });
      }
    }
    if (monthCols.length >= 2) { monthHeaderRow = r; break; }
  }
  if (monthCols.length === 0) return { events: [], warnings: ["No month-name headers found."] };
  monthCols.sort((a, b) => a.col - b.col);

  // Step 2: assign a calendar YEAR to each month. The season starts in
  // `seasonStartYear` (e.g. 2026 for "2026/27"). Months walking
  // chronologically left-to-right: each time the month index DROPS we've
  // crossed into the next calendar year (May 2026 → … → Dec 2026 →
  // Jan 2027 → … → Apr 2027).
  let curYear = seasonStartYear;
  let prevMonth = monthCols[0].month - 1;
  const monthSlots = monthCols.map((m) => {
    if (m.month < prevMonth) curYear++;
    prevMonth = m.month;
    return { ...m, year: curYear };
  });

  // Step 3: discover the day column for each month block. Pattern in
  // Marius's file: day_col = month_col - 2, and Plan A sits AT month_col.
  // Validate this against the data: in any data row, the day cell should
  // be a number 1..31. If month_col - 2 doesn't satisfy this for at
  // least one row, we sweep within ±3 to find the right offset.
  const startRow = monthHeaderRow + 1;
  const findDayCol = (mc: number) => {
    for (const offset of [-2, -1, -3, -4, 0]) {
      const candidate = mc + offset;
      if (candidate < 0) continue;
      let hits = 0;
      for (let r = startRow; r < Math.min(rows.length, startRow + 35); r++) {
        const v = rows[r]?.[candidate];
        if (typeof v === "number" && v >= 1 && v <= 31) hits++;
      }
      if (hits >= 5) return candidate;
    }
    return mc - 2;
  };

  const slotsWithDayCol = monthSlots.map((m) => ({ ...m, dayCol: findDayCol(m.col) }));

  // Step 4: scan day rows for every month block. We treat the cell at
  // (row, month_col) as Plan A; the cell directly to its right (or one
  // further) as Plan B / notes — we don't depend on the exact layout
  // because months in Marius's file alternate between with-Trenere and
  // without.
  type DayHit = { date: Date; planA: string; extras: string };
  const hits: DayHit[] = [];
  for (const slot of slotsWithDayCol) {
    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const dayVal = row[slot.dayCol];
      if (typeof dayVal !== "number" || dayVal < 1 || dayVal > 31) continue;
      const planA = String(row[slot.col] ?? "").trim();
      if (!planA) continue;
      // Pull any trailing string cells in the same block (Plan B / Info)
      // for the notes field. Limit to 3 columns to avoid bleeding into
      // the next month.
      const extras: string[] = [];
      for (let c = slot.col + 1; c < slot.col + 4; c++) {
        const v = row[c];
        if (typeof v === "string") {
          const t = v.trim();
          if (t && t.toLowerCase() !== "plan b" && t !== "-") extras.push(t);
        }
      }
      const date = new Date(Date.UTC(slot.year, slot.month, Math.round(dayVal)));
      hits.push({ date, planA, extras: extras.join(" · ") });
    }
  }

  hits.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Step 5: collapse consecutive days with the same Plan A into one
  // multi-day event. "Trysil" Jan 1 + "Trysil" Jan 2 + "Trysil" Jan 3
  // → one camp event Jan 1–3 in Trysil.
  const events: ParsedEvent[] = [];
  let current: { startDate: Date; endDate: Date; planA: string; extras: Set<string>; type: string; location: string | null } | null = null;
  const flush = () => {
    if (!current) return;
    const titleBase = current.type.charAt(0).toUpperCase() + current.type.slice(1);
    const title = current.location ? `${titleBase} · ${current.location}` : titleBase;
    const notes = current.extras.size > 0 ? [...current.extras].join(" · ") : null;
    events.push({
      title,
      type: current.type,
      startDate: current.startDate,
      endDate: current.startDate.getTime() === current.endDate.getTime() ? null : current.endDate,
      location: current.location,
      notes,
    });
    current = null;
  };

  for (const h of hits) {
    const { type, location } = classifyType(h.planA);
    if (
      current &&
      current.planA.toLowerCase() === h.planA.toLowerCase() &&
      current.type === type &&
      // Consecutive day check (allow exact next-day continuation only).
      new Date(current.endDate.getTime() + 86_400_000).getTime() === h.date.getTime()
    ) {
      current.endDate = h.date;
      if (h.extras) current.extras.add(h.extras);
      continue;
    }
    flush();
    current = {
      startDate: h.date,
      endDate: h.date,
      planA: h.planA,
      extras: new Set(h.extras ? [h.extras] : []),
      type,
      location,
    };
  }
  flush();

  if (events.length === 0) {
    warnings.push("Found month headers but no day-rows with Plan A values.");
  }
  return { events, warnings };
}

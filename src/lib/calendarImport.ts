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
function classifyHeader(header: string): keyof RawRow | null {
  const norm = header.trim().toLowerCase().replace(/[^a-z0-9 ]+/g, "");
  for (const rule of HEADER_RULES) {
    for (const kw of rule.keywords) {
      if (norm.includes(kw)) return rule.field;
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

export function parseCalendarFile(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { events: [], warnings: ["File has no sheets."], sheetName: "", totalRows: 0 };

  const ws = wb.Sheets[sheetName];
  // Get rows as arrays so we can map headers → fields ourselves rather
  // than trust the lib's auto-keying.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: null });
  if (rows.length === 0) {
    return { events: [], warnings: ["Sheet is empty."], sheetName, totalRows: 0 };
  }

  // Find the header row — typically row 0, but tolerate a 1- or 2-row
  // title block above it (common in Excel templates).
  let headerRowIdx = 0;
  let headerMap: (keyof RawRow | null)[] = [];
  for (let i = 0; i < Math.min(rows.length, 4); i++) {
    const candidate = (rows[i] ?? []).map((c) => toStr(c));
    const mapped = candidate.map((c) => classifyHeader(c));
    const hits = mapped.filter((x) => x !== null).length;
    if (hits >= 2) {
      headerRowIdx = i;
      headerMap = mapped;
      break;
    }
  }

  if (headerMap.length === 0) {
    return {
      events: [],
      warnings: [
        "Could not find a header row. Expected columns like: Start date, End date, Type, Location, Title, Notes (English or Italian).",
      ],
      sheetName,
      totalRows: rows.length,
    };
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

  if (events.length === 0 && warnings.length === 0) {
    warnings.push("No event rows found below the header.");
  }

  return { events, warnings, sheetName, totalRows: dataRows.length };
}

// Parser for Max's "CALENDARI TORNEI 2026" xlsx — one sheet per athlete,
// each sheet a 12-month × 4-week grid with 11 columns:
//   MESE | SETTIMANA | DATE-RANGE | FASE | (sport-cat) | OPEN | RODEO | CAT_X | ALT | TEAM
//
// The athlete-specific category column changes per sheet (Tommy = ITF
// junior U18, Pagan/Casciaro = ETA U12, Milan = Attività Giovanile,
// Rigoni = Attività Giovanile U16-18 + ETA U16). We capture this as the
// athlete's per-sheet column schema and store it in TennisSeasonPlan.columns
// so the planner UI can drive its own columns from data.
//
// Pure (no DB writes here) — returns a JSON shape the seed / server
// action then writes into TennisSeasonPlan + TennisSeasonPlanEntry +
// TennisTournament catalogue.

import * as XLSX from "xlsx";

export type ParsedTournamentEntry = {
  athleteSheet: string;          // "TOMMY"
  athleteDisplayName: string;    // "Tommaso"
  weekStart: Date | null;
  trainingPhase: string | null;
  columnKey: string;             // "ITF" | "OPEN" | "RODEO" | ...
  text: string;                  // raw cell content — "Open Naturns (BZ)" / "J60 Siroki Brijeg (BIH)"
  // Derived from text when possible:
  parsedName: string | null;
  parsedLocation: string | null;
  parsedDateRange: string | null;
};

export type ParsedPlan = {
  athleteSheet: string;          // "TOMMY"
  athleteDisplayName: string;    // "Tommaso"
  season: string;                // "2026"
  columns: string[];             // ordered category column keys
  entries: ParsedTournamentEntry[];
};

export type ParseTournamentResult = {
  plans: ParsedPlan[];
  warnings: string[];
};

// Italian month names → 1-based month number.
const MONTH_MAP: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

// Canonical category keys — what we store in TennisSeasonPlan.columns and
// on each Entry. The header text in Max's file varies (ITF junior (U18) /
// ETA (Tennis Europe U12) / 2° / 3° CATEGORIA) so we normalise it.
function normaliseColumn(header: string): string | null {
  const h = header.toLowerCase().replace(/\s+/g, " ").trim();
  if (!h) return null;
  if (h.includes("itf")) return "ITF";
  if (h.includes("eta") || h.includes("tennis europe")) return "ETA";
  if (h.includes("attività giovanile") || h.includes("attivita giovanile") || h.includes("youth")) return "YOUTH";
  if (h === "open") return "OPEN";
  if (h.includes("rodeo") && h.includes("open")) return "RODEO_OPEN";
  if (h.includes("rodeo")) return "RODEO";
  if (h.includes("under 12") || h.includes("under 14")) return "U12_14";
  if (h.match(/2.?\s*\/?\s*3.?\s*categoria/)) return "CAT_2_3";
  if (h.match(/3.?\s*\/?\s*4.?\s*categoria/)) return "CAT_3_4";
  if (h.match(/4.?\s*categoria/)) return "CAT_4";
  if (h.match(/2.?\s*categoria/)) return "CAT_2";
  if (h.match(/3.?\s*categoria/)) return "CAT_3";
  if (h.includes("alternativa") || h.includes("alt")) return "ALT";
  if (h.includes("campionati") || h.includes("squadre") || h.includes("team")) return "TEAM";
  if (h.includes("d1")) return "TEAM_D1";
  return null;
}

// Parse "22-01/04-02" / "02-12 / 08-03" / "9-14" → keep as-is if year ambiguous.
// Returns the original string when we can't normalise — UI shows what coach
// wrote.
function cleanRange(s: string): string | null {
  const v = s.trim();
  return v || null;
}

// Each sheet has 4 numbered weeks per month, but Max also uses the
// date-range column (col index 2) for tournaments that span week boundaries.
// We anchor every entry at the Monday of week N of month M for the year.
function mondayOfMonthWeek(year: number, month1: number, weekN: number): Date {
  // Week 1 = first Monday of the month (or close to it).
  const d = new Date(Date.UTC(year, month1 - 1, 1));
  const dow = d.getUTCDay(); // 0 = Sun
  const firstMonOffset = dow === 1 ? 0 : (1 - dow + 7) % 7;
  d.setUTCDate(d.getUTCDate() + firstMonOffset + (weekN - 1) * 7);
  return d;
}

// Heuristic: parse "J60 Siroki Brijeg (BIH)" → name="J60 Siroki Brijeg", location="BIH".
// We never throw away coach text; we only enrich.
function dissectCell(s: string): { name: string; location: string | null } {
  const trimmed = s.trim();
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(trimmed);
  if (m) return { name: m[1].trim(), location: m[2].trim() };
  return { name: trimmed, location: null };
}

// Italian first-name guess for the sheet → display name mapping. Max names
// the sheets after surname/nickname; we attempt a best-effort display name
// for the demo. Falls back to the sheet name.
const DISPLAY_NAME: Record<string, string> = {
  TOMMY: "Tommaso",
  PAGAN: "Gabriele",
  CASCIARO: "Pietro",
  MILAN: "Gianluca",
  RIGONI: "Alberto",
  ISA: "Isabella",
  LAURA: "Laura",
  VENTU: "Ventura",
  GAFFO: "Gaffo",
};

export function parseTournamentCalendar(buffer: ArrayBuffer, opts: { year?: number } = {}): ParseTournamentResult {
  const year = opts.year ?? new Date().getFullYear();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const plans: ParsedPlan[] = [];
  const warnings: string[] = [];

  for (const rawName of wb.SheetNames) {
    const sheetName = rawName.trim();
    const ws = wb.Sheets[rawName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
    if (rows.length < 3) continue;

    // Find the header row — it's the one with "MESE" / "SETTIMANA".
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(6, rows.length); i++) {
      const r = rows[i] ?? [];
      const first = String(r[0] ?? "").toLowerCase();
      if (first.startsWith("mese")) { headerRowIdx = i; break; }
    }
    if (headerRowIdx < 0) {
      warnings.push(`Sheet "${sheetName}": no MESE header found, skipped.`);
      continue;
    }
    const headerRow = (rows[headerRowIdx] ?? []) as unknown[];
    // Columns: 0=mese, 1=settimana, 2=date-range, 3=fase, then categories.
    const colMap: { col: number; key: string; rawHeader: string }[] = [];
    for (let c = 4; c < headerRow.length; c++) {
      const h = String(headerRow[c] ?? "").trim();
      if (!h) continue;
      const key = normaliseColumn(h);
      if (key) colMap.push({ col: c, key, rawHeader: h });
    }
    if (colMap.length === 0) {
      warnings.push(`Sheet "${sheetName}": no category columns recognised, skipped.`);
      continue;
    }

    const display = DISPLAY_NAME[sheetName.toUpperCase()] ?? sheetName;
    const entries: ParsedTournamentEntry[] = [];

    let currentMonth = 0;
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = (rows[i] ?? []) as unknown[];
      const meseRaw = String(r[0] ?? "").toLowerCase().trim();
      if (MONTH_MAP[meseRaw]) currentMonth = MONTH_MAP[meseRaw];

      const settRaw = String(r[1] ?? "").trim();
      const weekN = parseInt(settRaw, 10);
      if (!currentMonth || !Number.isFinite(weekN) || weekN < 1 || weekN > 5) continue;

      const weekStart = mondayOfMonthWeek(year, currentMonth, weekN);
      const dateRange = cleanRange(String(r[2] ?? ""));
      const phase = String(r[3] ?? "").trim() || null;

      for (const col of colMap) {
        const cell = String(r[col.col] ?? "").trim();
        if (!cell) continue;
        const d = dissectCell(cell);
        entries.push({
          athleteSheet: sheetName,
          athleteDisplayName: display,
          weekStart,
          trainingPhase: phase,
          columnKey: col.key,
          text: cell,
          parsedName: d.name,
          parsedLocation: d.location,
          parsedDateRange: dateRange,
        });
      }
    }

    plans.push({
      athleteSheet: sheetName,
      athleteDisplayName: display,
      season: String(year),
      columns: colMap.map((c) => c.key),
      entries,
    });
  }

  return { plans, warnings };
}

// Group entries → tournament catalogue de-dupe by (name, weekStart, columnKey)
// so the same Coppa U12 row that appears on 3 athletes' sheets becomes ONE
// TennisTournament row + 3 SeasonPlanEntry refs.
export function deriveCatalogue(plans: ParsedPlan[]): {
  catalogue: { key: string; name: string; location: string | null; startDate: Date; endDate: Date; category: string }[];
  byKey: Map<string, { athleteSheet: string; entries: ParsedTournamentEntry[] }>;
} {
  const map = new Map<string, { name: string; location: string | null; startDate: Date; endDate: Date; category: string; refs: ParsedTournamentEntry[] }>();
  for (const plan of plans) {
    for (const e of plan.entries) {
      if (!e.weekStart || !e.parsedName) continue;
      const key = `${e.parsedName.toLowerCase()}|${e.weekStart.toISOString().slice(0, 10)}|${e.columnKey}`;
      const endDate = new Date(e.weekStart);
      endDate.setUTCDate(endDate.getUTCDate() + 6);
      const existing = map.get(key);
      if (existing) existing.refs.push(e);
      else map.set(key, {
        name: e.parsedName,
        location: e.parsedLocation,
        startDate: e.weekStart,
        endDate,
        category: e.columnKey,
        refs: [e],
      });
    }
  }
  const catalogue = [...map.entries()].map(([key, v]) => ({
    key, name: v.name, location: v.location, startDate: v.startDate, endDate: v.endDate, category: v.category,
  }));
  const byKey = new Map<string, { athleteSheet: string; entries: ParsedTournamentEntry[] }>();
  for (const [key, v] of map) {
    byKey.set(key, { athleteSheet: v.refs[0].athleteSheet, entries: v.refs });
  }
  return { catalogue, byKey };
}

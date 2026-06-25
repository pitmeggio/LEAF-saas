// Flexible importer for stopwatch/timing exports (Microgate, Brower, Alge, …).
// Every system exports a table of rows — bib, athlete, run times, total, rank —
// but the column names and delimiter differ. This parser auto-detects the
// delimiter, maps columns by fuzzy header matching, and converts times to
// milliseconds. DB-free so it can run in the browser (parse + preview) before
// anything is saved. The coach reviews the match in a preview, then imports.

export type TimingRole = "bib" | "name" | "lastName" | "firstName" | "run1" | "run2" | "total" | "rank";

export type ParsedRow = {
  bib?: string;
  name?: string;
  run1Ms?: number;
  run2Ms?: number;
  totalMs?: number;
  rank?: number;
};

const HEADER_PATTERNS: { role: TimingRole; patterns: RegExp[] }[] = [
  { role: "bib", patterns: [/^bib$/, /pett/, /dossard/, /^n\.?°?$/, /^num/, /start.?n/, /^nr\.?$/] },
  { role: "lastName", patterns: [/cognome/, /surname/, /lastname/, /family/] },
  { role: "firstName", patterns: [/^nome$/, /firstname/, /given/] },
  { role: "name", patterns: [/name/, /atlet/, /competitor/, /racer/, /skier/, /participant/] },
  { role: "run1", patterns: [/run.?1/, /manche.?1/, /heat.?1/, /prova.?1/, /^m1$/, /^r1$/, /^t1$/, /1.?run/, /1.?manche/] },
  { role: "run2", patterns: [/run.?2/, /manche.?2/, /heat.?2/, /prova.?2/, /^m2$/, /^r2$/, /^t2$/, /2.?run/, /2.?manche/] },
  { role: "total", patterns: [/tot/, /finish/, /tempo/, /^time$/, /result/, /finale/, /combined/] },
  { role: "rank", patterns: [/rank/, /^pos/, /rang/, /place/, /classif/, /^pl\.?$/] },
];

function normHeader(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s._-]+/g, "");
}

// Convert "45.32", "45,32", "1:23.45", "01:23.456", "1:02:03.4" → milliseconds.
// Returns undefined for blank / DNF / DNS / DSQ.
export function parseTimeToMs(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim().replace(",", ".");
  if (!s || /^(dnf|dns|dsq|dq|nt|-+|n\/a)$/i.test(s)) return undefined;
  const parts = s.split(":").map((p) => p.trim());
  let sec: number;
  if (parts.length === 1) sec = parseFloat(parts[0]);
  else if (parts.length === 2) sec = parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  else if (parts.length === 3) sec = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
  else return undefined;
  if (!isFinite(sec) || sec <= 0) return undefined;
  return Math.round(sec * 1000);
}

// Format milliseconds as "ss.SS" (under a minute) or "m:ss.SS".
export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return m > 0 ? `${m}:${s.toFixed(2).padStart(5, "0")}` : s.toFixed(2);
}

// Split a delimited line honoring simple double-quote quoting.
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === delim && !inQ) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function detectDelimiter(headerLine: string): string {
  const candidates = [";", "\t", ",", "|"];
  let best = ",", bestN = 0;
  for (const d of candidates) {
    const n = headerLine.split(d).length;
    if (n > bestN) { bestN = n; best = d; }
  }
  return best;
}

export type ParseResult = { rows: ParsedRow[]; columns: Partial<Record<TimingRole, number>>; headers: string[]; delimiter: string };

export function parseTimingCsv(text: string): ParseResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { rows: [], columns: {}, headers: [], delimiter: "," };
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter);

  // Map each column index to a role by fuzzy header match (first match wins,
  // and each role is assigned at most once).
  const columns: Partial<Record<TimingRole, number>> = {};
  headers.forEach((h, idx) => {
    const nh = normHeader(h);
    for (const { role, patterns } of HEADER_PATTERNS) {
      if (columns[role] != null) continue;
      if (patterns.some((p) => p.test(nh))) { columns[role] = idx; break; }
    }
  });

  const get = (cells: string[], role: TimingRole) => {
    const i = columns[role];
    return i != null ? cells[i] : undefined;
  };

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    let name = get(cells, "name");
    const last = get(cells, "lastName");
    const first = get(cells, "firstName");
    if (!name && (last || first)) name = [last, first].filter(Boolean).join(" ");
    const run1Ms = parseTimeToMs(get(cells, "run1"));
    const run2Ms = parseTimeToMs(get(cells, "run2"));
    let totalMs = parseTimeToMs(get(cells, "total"));
    if (totalMs == null && run1Ms != null && run2Ms != null) totalMs = run1Ms + run2Ms;
    const rankRaw = get(cells, "rank");
    const rank = rankRaw && /^\d+$/.test(rankRaw.trim()) ? parseInt(rankRaw, 10) : undefined;
    const bib = get(cells, "bib")?.trim() || undefined;
    // Skip empty rows (no name and no time at all).
    if (!name && run1Ms == null && run2Ms == null && totalMs == null) continue;
    rows.push({ bib, name: name?.trim() || undefined, run1Ms, run2Ms, totalMs, rank });
  }
  return { rows, columns, headers, delimiter };
}

// ── Athlete matching ────────────────────────────────────────────────────────
function normName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

export type AthleteRef = { id: string; firstName: string; lastName: string };
export type MatchedRow = ParsedRow & { athleteId: string | null; matchedName: string | null; confidence: "exact" | "fuzzy" | "none" };

// Match each parsed row to an academy athlete by name. Handles "Surname Name"
// and "Name Surname" orderings, accents, and falls back to last-name match.
export function matchRows(rows: ParsedRow[], athletes: AthleteRef[]): MatchedRow[] {
  const byFull = new Map<string, AthleteRef>();
  const byLast = new Map<string, AthleteRef[]>();
  for (const a of athletes) {
    const full = normName(`${a.firstName} ${a.lastName}`);
    const rev = normName(`${a.lastName} ${a.firstName}`);
    byFull.set(full, a);
    byFull.set(rev, a);
    const last = normName(a.lastName);
    (byLast.get(last) ?? byLast.set(last, []).get(last)!).push(a);
  }
  return rows.map((r) => {
    if (!r.name) return { ...r, athleteId: null, matchedName: null, confidence: "none" as const };
    const n = normName(r.name);
    const exact = byFull.get(n);
    if (exact) return { ...r, athleteId: exact.id, matchedName: `${exact.firstName} ${exact.lastName}`, confidence: "exact" as const };
    // Token-based: try matching by last-name token (longest token usually).
    const tokens = n.split(" ").filter(Boolean);
    for (const t of tokens) {
      const cands = byLast.get(t);
      if (cands && cands.length === 1) {
        const a = cands[0];
        return { ...r, athleteId: a.id, matchedName: `${a.firstName} ${a.lastName}`, confidence: "fuzzy" as const };
      }
    }
    return { ...r, athleteId: null, matchedName: null, confidence: "none" as const };
  });
}

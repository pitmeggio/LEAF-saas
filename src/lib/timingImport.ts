// Flexible importer for stopwatch/timing exports (Split Second, Brower,
// Microgate, Alge, …). Real exports emit ONE ROW PER RUN, with a metadata
// preamble (team, session, event, hill, date), a header row, then rows that
// carry the run's finish time + intermediate split times. The separator varies
// (Split Second uses ">", others ";"/tab/","). We never sum runs — each run
// stands alone. DB-free so it can run in the browser to preview before saving.

export type ParsedRun = {
  bib?: string;
  name?: string;
  runNumber?: number;
  finishMs?: number;
  splitsMs: number[]; // cumulative intermediate splits, zeros/blanks dropped
  status?: string;
};

export type SessionMeta = { date?: string; event?: string; hill?: string; sessionLabel?: string };

export type ParseResult = {
  runs: ParsedRun[];
  meta: SessionMeta;
  splitCount: number;
  delimiter: string;
  headerFound: boolean;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s._-]+/g, "");
const metaKey = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

// "45.32", "45,32", "1:23.45", "01:23.456" → milliseconds. Blank / 0 / DNF → undefined.
export function parseTimeToMs(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim().replace(",", ".").replace(/\s*(am|pm)\s*$/i, "");
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

function detectDelimiter(lines: string[]): string {
  // Honor an explicit "sep=X" directive (Split Second writes "sep=>").
  for (const l of lines.slice(0, 3)) {
    const m = l.match(/^sep\s*=\s*(.)\s*$/i);
    if (m) return m[1];
  }
  const candidates = [">", ";", "\t", ",", "|"];
  let best = ",", bestN = 1;
  for (const d of candidates) {
    // score by the max column count any single line reaches
    const n = Math.max(...lines.slice(0, 25).map((l) => l.split(d).length));
    if (n > bestN) { bestN = n; best = d; }
  }
  return best;
}

const META_MAP: Record<string, keyof SessionMeta> = {
  date: "date", event: "event", hill: "hill",
};

export function parseTimingCsv(text: string): ParseResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "" && !/^sep\s*=/i.test(l));
  const allLines = text.replace(/\r\n?/g, "\n").split("\n");
  const delimiter = detectDelimiter(allLines.filter((l) => l.trim() !== ""));

  const meta: SessionMeta = {};
  let sessionNum = "", startList = "";
  let headerIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const nonEmpty = cells.filter((c) => c !== "");
    // Header row: many columns, includes "name" + (finish|run|split|time).
    const normCells = cells.map(norm);
    const looksHeader = cells.length >= 4 && normCells.some((c) => c.includes("name") || c.includes("atlet"))
      && normCells.some((c) => c.includes("finish") || c.includes("run") || c.includes("split") || c === "time" || c.includes("tempo"));
    if (looksHeader) { headerIdx = i; headers = cells; break; }
    // Preamble "Key>Value" → meta.
    if (nonEmpty.length >= 2) {
      const k = metaKey(cells[0]);
      const v = cells[1]?.trim() ?? "";
      if (META_MAP[k]) meta[META_MAP[k]] = v;
      else if (k === "session") sessionNum = v;
      else if (k === "startlistname") startList = v;
    }
  }
  if (sessionNum || startList) meta.sessionLabel = [sessionNum ? `Session #${sessionNum}` : "", startList].filter(Boolean).join(" · ");

  if (headerIdx === -1) return { runs: [], meta, splitCount: 0, delimiter, headerFound: false };

  // Map columns.
  const col: Record<string, number> = {};
  const splitCols: number[] = [];
  const assign = (role: string, idx: number) => { if (col[role] == null) col[role] = idx; };
  headers.forEach((h, idx) => {
    const nh = norm(h);
    if (/^(split|int|intermedio|s)\d+$/.test(nh) || /^splittime\d+$/.test(nh)) { splitCols.push(idx); return; }
    if (nh.includes("bib") || nh.includes("pett") || nh.includes("dossard") || nh === "nr") return assign("bib", idx);
    if (nh.includes("cognome") || nh.includes("surname") || nh.includes("lastname") || nh.includes("family")) return assign("lastName", idx);
    if (nh === "nome" || nh.includes("firstname") || nh.includes("given")) return assign("firstName", idx);
    if (nh.includes("name") || nh.includes("atlet") || nh.includes("competitor") || nh.includes("racer") || nh.includes("skier")) return assign("name", idx);
    if (nh.includes("finish") || nh.includes("result") || nh === "tempo" || nh === "total" || nh === "tot") return assign("finish", idx);
    if (nh.includes("run") || nh === "manche") return assign("run", idx);
    if (nh.includes("status")) return assign("status", idx);
    if (nh.includes("rank") || nh.startsWith("pos") || nh.includes("rang") || nh.includes("classif")) return assign("rank", idx);
  });

  const get = (cells: string[], role: string) => (col[role] != null ? cells[col[role]] : undefined);

  const runs: ParsedRun[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    if (cells.length < 2) continue;
    let name = get(cells, "name");
    const last = get(cells, "lastName"); const first = get(cells, "firstName");
    if (!name && (last || first)) name = [last, first].filter(Boolean).join(" ");
    const finishMs = parseTimeToMs(get(cells, "finish"));
    // Cumulative splits in header order; stop at first blank/zero.
    const splitsMs: number[] = [];
    for (const ci of splitCols) {
      const v = parseTimeToMs(cells[ci]);
      if (v == null) break;
      splitsMs.push(v);
    }
    const runRaw = get(cells, "run");
    const runNumber = runRaw && /^\d+$/.test(runRaw.trim()) ? parseInt(runRaw, 10) : undefined;
    const status = get(cells, "status")?.trim() || undefined;
    const bib = get(cells, "bib")?.trim() || undefined;
    if (!name && finishMs == null && splitsMs.length === 0) continue;
    runs.push({ bib, name: name?.trim() || undefined, runNumber, finishMs, splitsMs, status });
  }

  const splitCount = runs.reduce((m, r) => Math.max(m, r.splitsMs.length), 0);
  return { runs, meta, splitCount, delimiter, headerFound: true };
}

// ── Athlete matching ────────────────────────────────────────────────────────
function normName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

export type AthleteRef = { id: string; firstName: string; lastName: string };
export type MatchedRun = ParsedRun & { athleteId: string | null; matchedName: string | null; confidence: "exact" | "fuzzy" | "none" };

// Match each parsed run to an academy athlete by name. Handles "Surname Name"
// and "Name Surname" orderings, accents, and last-name-only exports.
export function matchRows(runs: ParsedRun[], athletes: AthleteRef[]): MatchedRun[] {
  const byFull = new Map<string, AthleteRef>();
  const byLast = new Map<string, AthleteRef[]>();
  for (const a of athletes) {
    byFull.set(normName(`${a.firstName} ${a.lastName}`), a);
    byFull.set(normName(`${a.lastName} ${a.firstName}`), a);
    const last = normName(a.lastName);
    (byLast.get(last) ?? byLast.set(last, []).get(last)!).push(a);
  }
  return runs.map((r) => {
    if (!r.name) return { ...r, athleteId: null, matchedName: null, confidence: "none" as const };
    const n = normName(r.name);
    const exact = byFull.get(n);
    if (exact) return { ...r, athleteId: exact.id, matchedName: `${exact.firstName} ${exact.lastName}`, confidence: "exact" as const };
    for (const t of n.split(" ").filter(Boolean)) {
      const cands = byLast.get(t);
      if (cands && cands.length === 1) {
        const a = cands[0];
        return { ...r, athleteId: a.id, matchedName: `${a.firstName} ${a.lastName}`, confidence: "fuzzy" as const };
      }
    }
    return { ...r, athleteId: null, matchedName: null, confidence: "none" as const };
  });
}

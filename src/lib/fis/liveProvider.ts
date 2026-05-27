import type { FisProvider, FisAthleteData, FisDisciplineSnapshot } from "./types";
import { colorForCode } from "./simulatedProvider";

// ─────────────────────────────────────────────────────────────────────────────
// LIVE FIS PROVIDER
// Real data, no scraping of rendered pages: FIS publishes the full alpine points
// list as a public CSV keyed by FIS code. We download the current list once,
// cache it in-process, and resolve athletes by code. This yields real identity,
// nation, gender, birth year and current points/world rank per discipline.
//
// Source: https://www.fis-ski.com/DB/alpine-skiing/fis-points-lists.html
// Export: .../ajax/fispointslistfunctions/export_fispointslist.html?export_csv=true&listid=<N>&sectorcode=AL
// ─────────────────────────────────────────────────────────────────────────────

const LIST_PAGE = "https://www.fis-ski.com/DB/alpine-skiing/fis-points-lists.html";
const EXPORT = (listid: number) =>
  `https://data.fis-ski.com/fis_athletes/ajax/fispointslistfunctions/export_fispointslist.html?export_csv=true&listid=${listid}&sectorcode=AL`;
const UA = "Mozilla/5.0 (compatible; LeafBot/1.0; +https://leaf-saas.vercel.app)";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — FIS publishes a new list every few weeks

// FIS uses ISO-3 nation codes; the app's COUNTRY map and DTOs use ISO-2.
const ISO3_TO_2: Record<string, string> = {
  SUI: "CH", ITA: "IT", NOR: "NO", AUT: "AT", FRA: "FR", SWE: "SE", GER: "DE", USA: "US",
  CAN: "CA", SLO: "SI", CRO: "HR", CZE: "CZ", GBR: "GB", SVK: "SK", FIN: "FI", POL: "PL",
  ESP: "ES", AND: "AD", BEL: "BE", NED: "NL", JPN: "JP", KOR: "KR", CHN: "CN", AUS: "AU",
  NZL: "NZ", LIE: "LI", BUL: "BG", GRE: "GR", ROU: "RO", SRB: "RS", BIH: "BA", HUN: "HU",
  UKR: "UA", EST: "EE", LAT: "LV", LTU: "LT", ISL: "IS", IRL: "IE", LUX: "LU", DEN: "DK",
  TUR: "TR", ARG: "AR", CHI: "CL", BRA: "BR", IRI: "IR", LBN: "LB", KAZ: "KZ", MGL: "MN",
  AZE: "AZ", GEO: "GE", ARM: "AM", MKD: "MK", MNE: "ME", ALB: "AL", CYP: "CY", MAR: "MA",
  RSA: "ZA", IND: "IN", PAK: "PK", THA: "TH", PHI: "PH", MEX: "MX", COL: "CO",
};
function iso2(nation3: string): string {
  const up = nation3.trim().toUpperCase();
  return ISO3_TO_2[up] ?? up.slice(0, 2);
}

// Column index → app discipline key. Lower points = better, so the athlete's
// "primary" discipline is the one with the lowest valid points.
const DISCIPLINE_COLS: { pts: number; pos: number; key: string }[] = [
  { pts: 18, pos: 19, key: "downhill" },
  { pts: 21, pos: 22, key: "slalom" },
  { pts: 24, pos: 25, key: "giant_slalom" },
  { pts: 27, pos: 28, key: "super_g" },
];

// Minimal RFC-4180 line parser (handles quoted fields containing commas).
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Per-list cache. The full points CSV (~3MB for alpine) is parsed once and
// kept by listid. Latest list drives `fetchByCode` (current snapshot); older
// lists feed `fetchHistoryByCode` (per-discipline trend). Memory budget for
// the default 4-list lookback is ~12MB per serverless instance.
type ListCache = { listid: number; publishedAt: Date; byCode: Map<string, string[]> };
const listCache = new Map<number, ListCache>();      // by listid
let recentLists: { listid: number; publishedAt: Date }[] = []; // newest-first
let recentListsAt = 0;                                // last index refresh
const inflightLists = new Map<number, Promise<ListCache>>();
let inflightIndex: Promise<{ listid: number; publishedAt: Date }[]> | null = null;

// Pull the points-lists index page and return {listid, publishedAt} tuples
// newest-first. We use the "valid from" date as the snapshot timestamp.
async function loadRecentListIndex(): Promise<{ listid: number; publishedAt: Date }[]> {
  if (recentLists.length && Date.now() - recentListsAt < CACHE_TTL_MS) return recentLists;
  if (!inflightIndex) {
    inflightIndex = (async () => {
      const html = await fetch(LIST_PAGE, { headers: { "User-Agent": UA }, cache: "no-store" }).then((r) => r.text());
      // Each row is roughly:
      //   <a href="...?listid=452">22nd FIS points list 2025/26</a>
      //   ... 01-05-2026 ...
      // We dedup by listid and pair each id with the FIRST DD-MM-YYYY date
      // that follows it in the source (the valid-from date FIS publishes
      // before the valid-to date).
      const seen = new Map<number, Date>();
      const re = /listid=(\d+)[\s\S]{0,2000}?(\d{2})-(\d{2})-(\d{4})/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        const id = Number(m[1]);
        if (!id || seen.has(id)) continue;
        const day = Number(m[2]);
        const mon = Number(m[3]);
        const yr = Number(m[4]);
        // Sanity: a valid-from date should be in the last ~5 years.
        const dt = new Date(Date.UTC(yr, mon - 1, day));
        if (yr < 2020 || yr > 2030 || mon < 1 || mon > 12 || day < 1 || day > 31) continue;
        seen.set(id, dt);
      }
      // Sort newest first by listid (FIS assigns ids monotonically).
      const sorted = [...seen.entries()]
        .map(([listid, publishedAt]) => ({ listid, publishedAt }))
        .sort((a, b) => b.listid - a.listid);
      return sorted;
    })().finally(() => { inflightIndex = null; });
  }
  recentLists = await inflightIndex;
  recentListsAt = Date.now();
  return recentLists;
}

async function resolveLatestListId(): Promise<number> {
  const lists = await loadRecentListIndex();
  if (!lists.length) throw new Error("Could not resolve a FIS points list id.");
  return lists[0].listid;
}

async function fetchListCsv(listid: number, publishedAt: Date): Promise<ListCache> {
  const cached = listCache.get(listid);
  if (cached) return cached;
  let inflight = inflightLists.get(listid);
  if (!inflight) {
    inflight = (async () => {
      const csv = await fetch(EXPORT(listid), { headers: { "User-Agent": UA }, cache: "no-store" }).then((r) => r.text());
      const byCode = new Map<string, string[]>();
      const lines = csv.split(/\r?\n/);
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        const f = parseCsvLine(lines[i]);
        const code = (f[7] ?? "").trim();
        if (code) byCode.set(code, f);
      }
      const c: ListCache = { listid, publishedAt, byCode };
      listCache.set(listid, c);
      return c;
    })().finally(() => { inflightLists.delete(listid); });
    inflightLists.set(listid, inflight);
  }
  return inflight;
}

// Latest list — used by fetchByCode for the current snapshot.
async function getLatestList(): Promise<ListCache> {
  const lists = await loadRecentListIndex();
  if (!lists.length) throw new Error("Could not resolve a FIS points list id.");
  return fetchListCsv(lists[0].listid, lists[0].publishedAt);
}

function isoFromDdMmYyyy(s: string): string {
  const m = s.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return new Date().toISOString();
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))).toISOString();
}

class LiveFisProvider implements FisProvider {
  readonly sourceName = "FIS (live)";

  async fetchByCode(rawCode: string): Promise<FisAthleteData | null> {
    const code = rawCode.trim();
    if (!/^\d{3,}$/.test(code)) return null; // real FIS codes are numeric

    let c: ListCache;
    try {
      c = await getLatestList();
    } catch {
      return null; // network/site issue → let the caller fall back
    }

    const f = c.byCode.get(code);
    if (!f) return null;

    const lastName = (f[8] ?? "").trim();
    const firstName = (f[9] ?? "").trim();
    if (!lastName || !firstName) return null;

    const nation = iso2(f[10] ?? "");
    const gender = (f[11] ?? "").trim().toUpperCase() === "W" ? "F" : "M";
    const birthYear = Number((f[16] ?? "").trim());
    if (!Number.isFinite(birthYear) || birthYear < 1980) return null;

    // Best (lowest valid points) discipline becomes the athlete's primary.
    let best: { key: string; points: number; rank: number } | null = null;
    for (const d of DISCIPLINE_COLS) {
      const raw = (f[d.pts] ?? "").trim();
      if (raw === "") continue; // no score in this discipline
      const pts = parseFloat(raw);
      const pos = parseInt(f[d.pos] ?? "", 10);
      // 0.00 is valid (the reference / best athlete); only skip empty or malformed.
      if (!Number.isFinite(pts) || pts < 0 || !Number.isFinite(pos) || pos <= 0) continue;
      if (!best || pts < best.points) best = { key: d.key, points: pts, rank: pos };
    }
    if (!best) return null; // no ranked discipline → nothing meaningful to show

    const calcIso = isoFromDdMmYyyy(f[17] ?? "");

    return {
      fisCode: code,
      firstName,
      lastName,
      nation,
      gender,
      birthYear,
      discipline: best.key,
      currentPoints: best.points,
      worldRank: best.rank,
      // Single real snapshot from the current list. Trend across multiple
      // lists is delivered separately via fetchHistoryByCode → stored in
      // FisListSnapshot rows and rendered by lib/ai/pointsTrend.ts.
      history: [{ date: calcIso, fisPoints: best.points, worldRank: best.rank }],
      results: [], // the points list carries no race-by-race results
    };
  }

  // Multi-list per-discipline history. Walks the most recent `lookbackLists`
  // FIS points lists in parallel and extracts every discipline's points for
  // the athlete from each. Athletes absent from a given list (e.g. before
  // they qualified) simply produce no row for that list — never fabricated.
  //
  // Cost: ~3MB CSV × lookbackLists fetched once per serverless instance.
  // Default 22 = a full alpine FIS season; that's ~66MB of CSV pulled and
  // parsed on the first call (10–15s on cold cache). Subsequent calls for
  // any athlete reuse the same in-memory snapshot for CACHE_TTL_MS = 6h.
  async fetchHistoryByCode(rawCode: string, lookbackLists = 22): Promise<FisDisciplineSnapshot[]> {
    const code = rawCode.trim();
    if (!/^\d{3,}$/.test(code)) return [];

    let index: { listid: number; publishedAt: Date }[];
    try {
      index = await loadRecentListIndex();
    } catch {
      return [];
    }
    const targets = index.slice(0, Math.max(1, lookbackLists));
    // Fetch CSVs in parallel; tolerate per-list failures (a 502 on one list
    // shouldn't break the whole sync).
    const results = await Promise.all(
      targets.map((t) => fetchListCsv(t.listid, t.publishedAt).catch(() => null)),
    );

    const out: FisDisciplineSnapshot[] = [];
    for (const c of results) {
      if (!c) continue;
      const f = c.byCode.get(code);
      if (!f) continue;
      for (const d of DISCIPLINE_COLS) {
        const raw = (f[d.pts] ?? "").trim();
        if (raw === "") continue;
        const pts = parseFloat(raw);
        if (!Number.isFinite(pts) || pts < 0) continue;
        const posRaw = (f[d.pos] ?? "").trim();
        const pos = posRaw ? parseInt(posRaw, 10) : NaN;
        out.push({
          listid: c.listid,
          publishedAt: c.publishedAt.toISOString(),
          discipline: d.key,
          fisPoints: pts,
          worldRank: Number.isFinite(pos) && pos > 0 ? pos : null,
        });
      }
    }
    // Stable ordering newest-first per discipline (matches list ordering).
    return out.sort((a, b) => b.listid - a.listid || a.discipline.localeCompare(b.discipline));
  }
}

export const liveFisProvider = new LiveFisProvider();
// Re-export for callers that need a deterministic colour from a code.
export { colorForCode };

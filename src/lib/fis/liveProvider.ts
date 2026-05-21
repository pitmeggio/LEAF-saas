import type { FisProvider, FisAthleteData } from "./types";
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

type Cache = { listid: number; at: number; byCode: Map<string, string[]> };
let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;

async function resolveLatestListId(): Promise<number> {
  const html = await fetch(LIST_PAGE, { headers: { "User-Agent": UA }, cache: "no-store" }).then((r) => r.text());
  const ids = [...html.matchAll(/listid=(\d+)/g)].map((m) => Number(m[1])).filter((n) => n > 0);
  if (!ids.length) throw new Error("Could not resolve a FIS points list id.");
  return Math.max(...ids);
}

async function buildCache(): Promise<Cache> {
  const listid = await resolveLatestListId();
  const csv = await fetch(EXPORT(listid), { headers: { "User-Agent": UA }, cache: "no-store" }).then((r) => r.text());
  const byCode = new Map<string, string[]>();
  const lines = csv.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = parseCsvLine(lines[i]);
    const code = (f[7] ?? "").trim();
    if (code) byCode.set(code, f);
  }
  return { listid, at: Date.now(), byCode };
}

async function getCache(): Promise<Cache> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;
  if (!inflight) inflight = buildCache().finally(() => { inflight = null; });
  cache = await inflight;
  return cache;
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

    let c: Cache;
    try {
      c = await getCache();
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
      // Single real snapshot from the current list. A multi-list trend (querying the
      // same code across past lists) is a future enhancement; we never fabricate one.
      history: [{ date: calcIso, fisPoints: best.points, worldRank: best.rank }],
      results: [], // the points list carries no race-by-race results
    };
  }
}

export const liveFisProvider = new LiveFisProvider();
// Re-export for callers that need a deterministic colour from a code.
export { colorForCode };

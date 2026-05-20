import type { FisProvider, FisAthleteData, FisPointSnapshot, FisResult } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATED FIS PROVIDER
// Produces realistic, deterministic athlete records from a FIS code.
// Replace this file with a real connector (fis-ski.com scraper or official feed)
// that implements the same FisProvider interface — nothing else needs to change.
// ─────────────────────────────────────────────────────────────────────────────

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_M = ["Lucas", "Henrik", "Marco", "Felix", "Jonas", "Erik", "Anton", "Tobias", "Matteo", "Nils"];
const FIRST_F = ["Emma", "Sofia", "Mathilde", "Chiara", "Lea", "Sara", "Nora", "Giulia", "Ingrid", "Hanna"];
const LAST: Record<string, string[]> = {
  AT: ["Brandt", "Moser", "Hofer", "Gruber", "Steiner", "Wagner"],
  NO: ["Berg", "Hansen", "Aas", "Dahl", "Solberg", "Haugen"],
  IT: ["Rossi", "Bianchi", "Ferrari", "Conti", "Greco", "De Luca"],
  SE: ["Lindqvist", "Eriksson", "Berg", "Nyström", "Holm", "Sandberg"],
  CH: ["Meier", "Keller", "Brunner", "Graf", "Vogel", "Frei"],
  FR: ["Martin", "Bernard", "Faure", "Roux", "Girard", "Lemaire"],
  SI: ["Kovač", "Novak", "Horvat", "Kranjc", "Zupan", "Bizjak"],
};
const NATIONS = ["AT", "NO", "IT", "SE", "CH", "FR", "SI"] as const;
const DISCIPLINES = ["slalom", "giant_slalom", "super_g", "downhill"] as const;
const EVENTS = ["FIS Race", "Europa Cup", "National Championship", "NorAm Cup", "Junior World Championship", "FIS Citadin"];
const VENUES: Record<string, string> = {
  AT: "Schladming, AT", NO: "Hafjell, NO", IT: "Val Gardena, IT", SE: "Åre, SE",
  CH: "Adelboden, CH", FR: "Val d'Isère, FR", SI: "Kranjska Gora, SI",
};

// Curated demo records: nice named results for codes shown in the UI.
const KNOWN: Record<string, Partial<FisAthleteData>> = {
  "6294001": { firstName: "Maxime", lastName: "Faure", nation: "FR", gender: "M", birthYear: 2007, discipline: "giant_slalom", currentPoints: 16.4 },
  "5121884": { firstName: "Ingrid", lastName: "Solberg", nation: "NO", gender: "F", birthYear: 2008, discipline: "slalom", currentPoints: 23.1 },
  "6535129": { firstName: "Anton", lastName: "Brunner", nation: "CH", gender: "M", birthYear: 2006, discipline: "downhill", currentPoints: 11.8 },
  "6293770": { firstName: "Sara", lastName: "Greco", nation: "IT", gender: "F", birthYear: 2009, discipline: "super_g", currentPoints: 34.7 },
};

const PALETTE = ["#0ea5e9", "#f59e0b", "#10b981", "#6366f1", "#ec4899", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#22c55e", "#3b82f6", "#d946ef"];

export function colorForCode(code: string): string {
  return PALETTE[hash(code) % PALETTE.length];
}

function isoMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(15);
  return d.toISOString();
}

function round(n: number, p = 2): number {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

class SimulatedFisProvider implements FisProvider {
  readonly sourceName = "FIS (simulated)";

  async fetchByCode(rawCode: string): Promise<FisAthleteData | null> {
    const code = rawCode.trim();
    if (!/^[A-Za-z0-9-]{3,}$/.test(code)) return null;

    const rng = mulberry32(hash(code));
    const known = KNOWN[code] ?? {};

    const gender = (known.gender ?? (rng() > 0.5 ? "M" : "F")) as "M" | "F";
    const nation = known.nation ?? NATIONS[Math.floor(rng() * NATIONS.length)];
    const discipline = known.discipline ?? DISCIPLINES[Math.floor(rng() * DISCIPLINES.length)];
    const firstName =
      known.firstName ?? (gender === "M" ? FIRST_M : FIRST_F)[Math.floor(rng() * 10)];
    const lastName = known.lastName ?? LAST[nation][Math.floor(rng() * LAST[nation].length)];
    const birthYear = known.birthYear ?? 2004 + Math.floor(rng() * 7); // ~15-22 yo

    // Current points (lower = better) and a 12-month improving history.
    const currentPoints = known.currentPoints ?? round(8 + rng() * 70, 2);
    const improvement = 8 + rng() * 35; // points improved over the year
    const startPoints = currentPoints + improvement;
    const baseRank = 40 + Math.floor(rng() * 320);

    const history: FisPointSnapshot[] = [];
    const span = 12;
    for (let m = 0; m <= span; m++) {
      const t = m / span;
      const noise = (rng() - 0.4) * 2.0;
      const pts = Math.max(4, round(startPoints + (currentPoints - startPoints) * t + noise, 2));
      const worldRank = Math.round(baseRank * (1 + (1 - t) * 1.5));
      history.push({ date: isoMonthsAgo(span - m), fisPoints: pts, worldRank });
    }
    const worldRank = known.worldRank ?? history[history.length - 1].worldRank;

    const results: FisResult[] = [];
    for (let r = 0; r < 6; r++) {
      results.push({
        date: isoMonthsAgo(r * 2 + 1),
        eventName: EVENTS[Math.floor(rng() * EVENTS.length)],
        location: VENUES[nation],
        discipline,
        rank: 1 + Math.floor(rng() * 30),
        fisPoints: Math.max(4, round(currentPoints + (rng() * 10 - 3), 2)),
      });
    }

    return {
      fisCode: code,
      firstName,
      lastName,
      nation,
      gender,
      birthYear,
      discipline,
      currentPoints,
      worldRank,
      history,
      results,
    };
  }
}

export const simulatedFisProvider = new SimulatedFisProvider();

export const DEMO_FIS_CODES = Object.keys(KNOWN);

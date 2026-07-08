// TennisTalker connector — the public Italian tennis data source (aggregates the
// FIT classifica). Free endpoints let us search a player by NAME and read their
// current FIT classifica + federation card number. Multi-year history is behind
// their paid Club Membership (403), so LEAF imports the current classifica as a
// dated snapshot and builds the trajectory itself over repeated syncs.
//
// Server-only (outbound fetch). Kept behind this thin module so the source can
// be swapped without touching the actions/UI.

const BASE = "https://api.tennistalker.it/api";
const UA = "LEAF-OS/1.0 (sports academy management)";
const TIMEOUT_MS = 10_000;

async function ttFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TennisTalker ${res.status}`);
  return res.json() as Promise<T>;
}

// TennisTalker returns names as "LASTNAME FIRSTNAME" in caps → present as
// "Firstname Lastname" title case for the UI.
export function prettyName(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return t;
}

export type TTPlayer = {
  id: number;
  name: string;        // raw "LASTNAME FIRSTNAME"
  classifica: string | null; // FIT classifica, e.g. "2.6" | "4.NC"
  category: string | null;   // e.g. "NOR", "U18", "O40"
};

export async function ttSearchPlayers(query: string): Promise<TTPlayer[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const data = await ttFetch<unknown>(`/fit-player-profiles/search?query=${encodeURIComponent(q)}`);
  if (!Array.isArray(data)) return [];
  return data
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .slice(0, 25)
    .map((p) => ({
      id: Number(p.id),
      name: String(p.name ?? ""),
      classifica: (p.rank as string) ?? null,
      category: (p.category as string) ?? null,
    }))
    .filter((p) => Number.isFinite(p.id) && p.name);
}

export type TTPlayerDetail = {
  id: number;
  name: string;
  cardNumber: string | null; // FIT tessera
  classifica: string | null;
  category: string | null;
};

export async function ttGetPlayer(id: number): Promise<TTPlayerDetail | null> {
  const p = await ttFetch<Record<string, unknown>>(`/fit-player-profiles/${id}`);
  if (!p || typeof p !== "object" || p.id == null) return null;
  return {
    id: Number(p.id),
    name: String(p.name ?? ""),
    cardNumber: (p.card_number as string) ?? null,
    classifica: (p.rank as string) ?? null,
    category: (p.category as string) ?? null,
  };
}

// Living athlete profile maintained by Coach Intelligence. Every new structured
// coach note feeds this merger, which keeps rolling counters per theme,
// recurring strengths/weaknesses, injury flags, priorities and a trend hint per
// dimension. Pure (no I/O) — the caller persists the result to athlete.aiProfile.

import type { CoachNoteStructure } from "@/lib/ai/coachNotes";

export type Counted = { text: string; count: number; lastSeen: string };

export type AthleteAiProfile = {
  schemaVersion: 1;
  lastUpdatedAt: string;
  noteCount: number;
  // How often each theme has appeared — top entries advertise the coach's lens
  // for this athlete (e.g. "technical-heavy", "mental-heavy").
  themeFrequency: Record<string, number>;
  // Aggregated narrative buckets — capped lists, dedup-on-merge.
  recurringStrengths: Counted[];
  recurringWeaknesses: Counted[];
  injuryFlags: Counted[];
  priorities: Counted[];
  // Trend hint per dimension: "rising" = mentioned often + recently;
  // "stable" = consistent; "watch" = weakness or injury surfaced last 3 notes.
  trends: Record<string, "rising" | "stable" | "watch">;
};

const MAX_LIST_LEN = 10;

export function emptyAiProfile(now = new Date()): AthleteAiProfile {
  return {
    schemaVersion: 1,
    lastUpdatedAt: now.toISOString(),
    noteCount: 0,
    themeFrequency: {},
    recurringStrengths: [],
    recurringWeaknesses: [],
    injuryFlags: [],
    priorities: [],
    trends: {},
  };
}

// Merge a new structured note into the prior profile. Pure: returns a NEW
// object, never mutates the input.
export function mergeNoteIntoProfile(
  prev: AthleteAiProfile | null,
  structure: CoachNoteStructure,
  at: Date = new Date(),
): AthleteAiProfile {
  const base = prev ? { ...prev } : emptyAiProfile(at);
  const stamp = at.toISOString();

  // Theme frequency — bump every detected theme.
  const themeFrequency = { ...base.themeFrequency };
  for (const t of structure.themes) themeFrequency[t] = (themeFrequency[t] ?? 0) + 1;

  const recurringStrengths = bumpList(base.recurringStrengths, structure.strengths, stamp);
  const recurringWeaknesses = bumpList(base.recurringWeaknesses, structure.weaknesses, stamp);
  const priorities = bumpList(base.priorities, structure.priorities, stamp);
  const injuryFlags = bumpList(base.injuryFlags, structure.injuryFlags, stamp);

  // Trends are computed from current state. Cheap heuristic — top themes that
  // are also frequent become "rising"; injury surfaced → "watch"; rest "stable".
  const trends: Record<string, "rising" | "stable" | "watch"> = {};
  for (const [theme, count] of Object.entries(themeFrequency)) {
    if (theme === "injury" || injuryFlags.length > 0) {
      trends[theme] = theme === "injury" ? "watch" : trends[theme] ?? "stable";
    } else if (count >= 3 && structure.themes.includes(theme)) {
      trends[theme] = "rising";
    } else {
      trends[theme] = "stable";
    }
  }
  if (injuryFlags.length > 0) trends.injury = "watch";

  return {
    schemaVersion: 1,
    lastUpdatedAt: stamp,
    noteCount: base.noteCount + 1,
    themeFrequency,
    recurringStrengths,
    recurringWeaknesses,
    injuryFlags,
    priorities,
    trends,
  };
}

// ── Tennis level suggestions ────────────────────────────────────────────
// Derives proposed 1-10 bumps for the 4 development levels (technical /
// tactical / physical / mental) from the rolling themeFrequency. Pure: the
// UI shows them as a non-destructive "AI suggests" line — admin chooses
// whether to accept and persist them via the existing edit form.
export type LevelSuggestion = {
  dimension: "technical" | "tactical" | "physical" | "mental";
  current: number | null;
  suggested: number;
  reason: string; // short human sentence
};

const DIMENSION_THEMES: Record<LevelSuggestion["dimension"], string[]> = {
  technical: ["technical"],
  tactical: ["tactical", "race", "match"],
  physical: ["physical", "recovery"],
  mental: ["mental"],
};

export function deriveLevelSuggestions(
  profile: AthleteAiProfile | null,
  currentLevels: { technical: number | null; tactical: number | null; physical: number | null; mental: number | null },
): LevelSuggestion[] {
  if (!profile || profile.noteCount < 2) return [];
  const totalThemeHits = Object.values(profile.themeFrequency).reduce((s, v) => s + v, 0) || 1;
  const out: LevelSuggestion[] = [];
  const trends = profile.trends ?? {};
  const hasInjury = (profile.injuryFlags?.length ?? 0) > 0;

  for (const dim of Object.keys(DIMENSION_THEMES) as LevelSuggestion["dimension"][]) {
    const themes = DIMENSION_THEMES[dim];
    const hits = themes.reduce((s, t) => s + (profile.themeFrequency[t] ?? 0), 0);
    if (hits === 0) continue;
    const share = hits / totalThemeHits; // 0..1
    const current = currentLevels[dim] ?? 5;
    // Cheap mapping: dominant share lifts the level; injury cue caps the
    // physical bump (don't push physical up while an injury is on the books).
    let suggested = current;
    if (share >= 0.4) suggested = Math.min(10, current + 1);
    if (share >= 0.6) suggested = Math.min(10, current + 2);
    // Weakness recurring on this dimension → soft pull-down by 1.
    const dimWeak = profile.recurringWeaknesses.some((w) =>
      themes.some((t) => w.text.toLowerCase().includes(t)),
    );
    if (dimWeak) suggested = Math.max(1, suggested - 1);
    if (dim === "physical" && hasInjury) suggested = Math.min(suggested, current);
    if (suggested === current) continue;

    const direction = suggested > current ? "↑" : "↓";
    const trend = trends[themes[0]] ?? "stable";
    out.push({
      dimension: dim,
      current: currentLevels[dim],
      suggested,
      reason: `${direction} ${Math.round(share * 100)}% of notes touch ${dim}${trend === "rising" ? " (trend rising)" : ""}${dimWeak ? " · weakness pattern" : ""}`,
    });
  }
  return out;
}

// Lightweight string-canonicaliser for dedup. Lowercase + collapse whitespace
// + strip trailing punctuation. Stable enough that "Tired in the second run"
// and "tired in the second run." merge into one counter.
function canonical(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?;:]+$/g, "")
    .trim();
}

// Merge an incoming list of items into a Counted list, bumping count + lastSeen
// when an entry already exists. Caps to MAX_LIST_LEN, ordered by recency + count.
function bumpList(prev: Counted[], incoming: string[], stamp: string): Counted[] {
  const map = new Map<string, Counted>();
  for (const item of prev) map.set(canonical(item.text), item);
  for (const raw of incoming) {
    const key = canonical(raw);
    if (!key) continue;
    const cur = map.get(key);
    if (cur) {
      map.set(key, { text: cur.text, count: cur.count + 1, lastSeen: stamp });
    } else {
      map.set(key, { text: raw, count: 1, lastSeen: stamp });
    }
  }
  return [...map.values()]
    .sort((a, b) => (b.lastSeen.localeCompare(a.lastSeen) || b.count - a.count))
    .slice(0, MAX_LIST_LEN);
}

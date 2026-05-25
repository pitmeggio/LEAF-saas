// Coach personalization — the engine learns how each coach writes over time.
// Same shape ideas as AthleteAiProfile (theme frequency + counted lists), but
// aggregated per Coach instead of per Athlete. Pure: caller persists.

import type { CoachNoteStructure } from "@/lib/ai/coachNotes";

export type CoachAiStyle = {
  schemaVersion: 1;
  lastUpdatedAt: string;
  noteCount: number;
  // Theme frequency across every note this coach has written.
  themeFrequency: Record<string, number>;
  // Words/phrases the coach reaches for repeatedly (taken from their own
  // sentences, not the AI's). Capped + dedup-merged.
  recurringTerms: { text: string; count: number }[];
};

const MAX_TERMS = 12;

export function emptyCoachStyle(now = new Date()): CoachAiStyle {
  return {
    schemaVersion: 1,
    lastUpdatedAt: now.toISOString(),
    noteCount: 0,
    themeFrequency: {},
    recurringTerms: [],
  };
}

export function mergeCoachStyle(
  prev: CoachAiStyle | null,
  structure: CoachNoteStructure,
  rawText: string,
  at: Date = new Date(),
): CoachAiStyle {
  const base = prev ?? emptyCoachStyle(at);
  const themeFrequency = { ...base.themeFrequency };
  for (const t of structure.themes) themeFrequency[t] = (themeFrequency[t] ?? 0) + 1;

  // Recurring terms — naive but useful: pull capitalised / multi-word tokens
  // from the raw text (likely domain words like "GS line", "split time"…).
  const terms = extractTerms(rawText);
  const termMap = new Map<string, { text: string; count: number }>();
  for (const t of base.recurringTerms) termMap.set(t.text.toLowerCase(), t);
  for (const term of terms) {
    const key = term.toLowerCase();
    const cur = termMap.get(key);
    if (cur) termMap.set(key, { text: cur.text, count: cur.count + 1 });
    else termMap.set(key, { text: term, count: 1 });
  }
  const recurringTerms = [...termMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TERMS);

  return {
    schemaVersion: 1,
    lastUpdatedAt: at.toISOString(),
    noteCount: base.noteCount + 1,
    themeFrequency,
    recurringTerms,
  };
}

// Quick lens summary for the LLM system prompt. Returns a one-line hint or
// empty string when we don't have enough signal yet (< 3 notes).
export function coachStyleHint(style: CoachAiStyle | null): string {
  if (!style || style.noteCount < 3) return "";
  const top = Object.entries(style.themeFrequency).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
  if (top.length === 0) return "";
  return `Coach lens: this coach tends to focus on ${top.join(" / ")}.`;
}

// Pull recurring multi-word phrases / capitalised tokens. Cheap heuristic.
function extractTerms(text: string): string[] {
  const out: string[] = [];
  // 2-word capitalised phrases (e.g. "Saas Fee", "GS line").
  const cap2 = text.match(/\b[A-Z][a-zA-Z]+ [A-Z][a-zA-Z]+\b/g) ?? [];
  out.push(...cap2);
  // Lowercase technical 2-grams from a short allowlist of ski/tennis words —
  // small + safe, mostly there to bootstrap "edge control", "line choice".
  const lower = text.toLowerCase();
  const phrases = ["edge control", "line choice", "split time", "outside ski", "upper body", "shot selection", "shot pattern", "rally pattern", "match point"];
  for (const p of phrases) if (lower.includes(p)) out.push(p);
  return out.slice(0, 8);
}

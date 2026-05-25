// Adaptive Coach Notes — turns a raw, free-form coach observation into a
// dynamic structured analysis. Two engines live here:
//
//  - llmStructure     when ANTHROPIC_API_KEY is set, asks Claude to produce
//                     sport-aware sections + priorities + flags as JSON
//  - deterministicStructure  pure keyword + sentiment heuristics, runs
//                     anywhere — used as the always-on fallback and as the
//                     baseline for unit tests
//
// Both produce the same CoachNoteStructure shape so the UI never has to
// branch on "which engine was used". The engine field carries provenance.

import { callLlm, extractJson, llmConfigured } from "@/lib/ai/llm";

export type CoachNoteSection = {
  title: string;
  bullets: string[];
};

export type CoachNoteStructure = {
  // Sport context the structurer worked against (echoed from input).
  sport: string;
  // Best-effort kind classification (ski/tennis-aware).
  detectedKind: string | null;
  // Themes the AI prioritised — order matters (most prominent first).
  themes: string[];
  // Dynamic sections — titles are themes ("Technical analysis", "Mental notes",
  // …); shape is intentionally not fixed.
  sections: CoachNoteSection[];
  priorities: string[];
  strengths: string[];
  weaknesses: string[];
  injuryFlags: string[];
  // 0..1 confidence — used by the UI to grade how strongly to lean on the AI.
  confidence: number;
  engine: "llm" | "deterministic";
};

export type StructureInput = {
  rawText: string;
  sport: string; // "ski" | "tennis" | future
  kindHint?: string | null;
};

// Public entry point. Always returns a structure — never throws.
export async function structureCoachNote(input: StructureInput): Promise<CoachNoteStructure> {
  if (llmConfigured()) {
    const llm = await llmStructure(input);
    if (llm) return llm;
  }
  return deterministicStructure(input);
}

// ─────────────────────────────────────────────────────────────────────────
// LLM engine
// ─────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are LEAF Coach Intelligence — an analytical assistant for elite sports academies.
You read raw, free-form coach observations and structure them dynamically.

CORE RULES
- Adapt the lens to the sport (ski → technical, tactical, physical, mental, race; tennis → serve, shot patterns, movement, mental).
- Pick section TITLES from the content. Do NOT force every section on every note. A short technical-only note returns one section.
- Be concise and concrete. Bullets are 1–2 sentences; no fluff, no advice the coach didn't imply.
- Never fabricate measurements (FIS points, scores, rankings) the coach didn't mention.
- If the note hints at injury / pain / fatigue risk, surface it under injuryFlags.

OUTPUT
Return STRICT JSON only (no prose, no markdown fences). Schema:
{
  "detectedKind": string | null,
  "themes": string[],
  "sections": [{ "title": string, "bullets": string[] }],
  "priorities": string[],
  "strengths": string[],
  "weaknesses": string[],
  "injuryFlags": string[],
  "confidence": number
}`;

async function llmStructure(input: StructureInput): Promise<CoachNoteStructure | null> {
  const user = [
    `Sport context: ${input.sport}`,
    input.kindHint ? `Coach-supplied kind hint: ${input.kindHint}` : null,
    "Coach note:",
    input.rawText,
    "",
    'Respond with the JSON object only.',
  ]
    .filter(Boolean)
    .join("\n");

  const r = await callLlm([{ role: "user", content: user }], {
    system: SYSTEM_PROMPT,
    purpose: "coach-note-structurer",
    maxTokens: 1500,
    temperature: 0.2,
  });
  if (!r) return null;
  const parsed = extractJson<Partial<CoachNoteStructure>>(r.text);
  if (!parsed || !Array.isArray(parsed.sections)) return null;
  // Hard-normalise to the canonical shape so the UI never sees missing arrays.
  return {
    sport: input.sport,
    detectedKind: typeof parsed.detectedKind === "string" ? parsed.detectedKind : null,
    themes: Array.isArray(parsed.themes) ? parsed.themes.map(String) : [],
    sections: parsed.sections.map((s) => ({
      title: String(s?.title ?? "Notes"),
      bullets: Array.isArray(s?.bullets) ? s!.bullets.map(String) : [],
    })),
    priorities: Array.isArray(parsed.priorities) ? parsed.priorities.map(String) : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
    injuryFlags: Array.isArray(parsed.injuryFlags) ? parsed.injuryFlags.map(String) : [],
    confidence: typeof parsed.confidence === "number" ? clamp01(parsed.confidence) : 0.75,
    engine: "llm",
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Deterministic fallback — pure (no I/O), keyword-driven, sport-aware.
// Stable enough to back unit tests + demos without an API key.
// ─────────────────────────────────────────────────────────────────────────
type Theme = "technical" | "tactical" | "physical" | "mental" | "race" | "match" | "injury" | "recovery";

// Per-sport keyword maps. Generic terms (focus, tired, …) carry across sports.
const KEYWORDS: Record<string, Partial<Record<Theme, string[]>>> = {
  ski: {
    technical: ["edge", "edges", "edging", "pressure", "balance", "stance", "line", "split", "carving", "angulation", "inclination", "upper body", "hip", "core position", "stivali", "sciate"],
    tactical: ["line choice", "race line", "tactical", "course", "section", "gate", "set"],
    physical: ["fatigue", "tired", "explosive", "explosiveness", "strength", "endurance", "cardio", "conditioning", "leg", "stanchezza"],
    mental: ["focus", "nervous", "pressure", "anxious", "confidence", "composed", "doubt", "motivation", "head"],
    race: ["race", "qualifier", "fis race", "world cup", "gara", "tempo", "split time"],
    injury: ["pain", "knee", "back", "shoulder", "ankle", "injury", "concussion", "sore", "dolore"],
    recovery: ["recovery", "rest", "ice", "physio", "massage", "stretch"],
  },
  tennis: {
    technical: ["serve", "forehand", "backhand", "volley", "slice", "topspin", "grip", "swing", "footwork stroke", "racket", "racquet"],
    tactical: ["pattern", "rally", "shot selection", "placement", "depth", "court position", "approach", "drop shot", "tactic"],
    physical: ["movement", "endurance", "explosive", "recovery between points", "footwork", "fatigue", "stamina"],
    mental: ["focus", "pressure", "tie break", "tiebreak", "match point", "set point", "nervous", "composure", "head"],
    match: ["match", "set", "game", "break", "rally"],
    injury: ["shoulder", "elbow", "wrist", "knee", "pain", "soreness", "injury"],
    recovery: ["recovery", "rest", "ice", "physio", "massage", "stretch"],
  },
};

// Generic positive/negative cues — feed strengths/weaknesses across sports.
const POSITIVE_CUES = ["strong", "excellent", "great", "improving", "improved", "solid", "consistent", "confident", "clean", "explosive"];
const NEGATIVE_CUES = ["weak", "struggled", "inconsistent", "lost", "slow", "late", "off-balance", "tense", "tight", "tired", "doubt"];

const THEME_TITLES: Record<Theme, string> = {
  technical: "Technical analysis",
  tactical: "Tactical analysis",
  physical: "Physical analysis",
  mental: "Mental analysis",
  race: "Race notes",
  match: "Match notes",
  injury: "Injury risk",
  recovery: "Recovery notes",
};

const KIND_KEYWORDS: { kind: string; words: string[] }[] = [
  { kind: "race", words: ["race", "gara", "split", "world cup", "fis race", "qualifier"] },
  { kind: "match", words: ["match", "set", "game", "tiebreak", "tie break", "break point"] },
  { kind: "video_review", words: ["video", "footage", "playback", "rewatch"] },
  { kind: "physical_block", words: ["block", "gym", "physical session", "strength session", "cardio session"] },
  { kind: "testing", words: ["test", "testing", "benchmark", "field test"] },
  { kind: "training_session", words: ["training", "session", "drill", "block"] },
];

export function deterministicStructure(input: StructureInput): CoachNoteStructure {
  const text = (input.rawText ?? "").trim();
  const lower = text.toLowerCase();
  const sport = (input.sport || "ski").toLowerCase();
  const sentences = splitSentences(text);

  const map = KEYWORDS[sport] ?? KEYWORDS.ski;
  // Score each theme by keyword hits. Sentences containing the keyword fuel the section.
  const themeScores = new Map<Theme, { score: number; sentences: Set<string> }>();
  (Object.keys(map) as Theme[]).forEach((theme) => {
    const kws = map[theme] ?? [];
    let score = 0;
    const matched = new Set<string>();
    for (const kw of kws) {
      const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, "i");
      if (re.test(lower)) score += 1;
      for (const s of sentences) {
        if (re.test(s.toLowerCase())) matched.add(s);
      }
    }
    if (score > 0) themeScores.set(theme, { score, sentences: matched });
  });

  // Sort themes by score → drives section order (most prominent first).
  const themes = [...themeScores.entries()].sort((a, b) => b[1].score - a[1].score);
  const sections: CoachNoteSection[] = themes.map(([theme, info]) => ({
    title: THEME_TITLES[theme],
    bullets: pickBullets([...info.sentences], 3),
  }));

  // Fallback section so even content-free notes don't render empty.
  if (sections.length === 0 && text.length > 0) {
    sections.push({ title: "Session summary", bullets: pickBullets(sentences, 3) });
  }

  const injuryFlags: string[] = [];
  const injuryInfo = themeScores.get("injury");
  if (injuryInfo) injuryFlags.push(...pickBullets([...injuryInfo.sentences], 2));

  const detectedKind = input.kindHint ?? detectKind(lower);

  const strengths = sentences.filter((s) => POSITIVE_CUES.some((w) => s.toLowerCase().includes(w))).slice(0, 3);
  const weaknesses = sentences.filter((s) => NEGATIVE_CUES.some((w) => s.toLowerCase().includes(w))).slice(0, 3);

  // Priorities = the worst weaknesses, dedup-friendly + capped at 3.
  const priorities = weaknesses.slice(0, 3).map((s) => `Address: ${s.replace(/[.!?]+$/, "").toLowerCase()}`);
  // Confidence grows with theme hits and shrinks with very short notes.
  const baseConfidence = Math.min(0.6, 0.15 + themes.length * 0.12);
  const lengthBonus = text.length > 280 ? 0.05 : 0;
  const confidence = clamp01(baseConfidence + lengthBonus);

  return {
    sport,
    detectedKind,
    themes: themes.map(([t]) => t),
    sections,
    priorities,
    strengths,
    weaknesses,
    injuryFlags,
    confidence,
    engine: "deterministic",
  };
}

// ── Small pure helpers ──────────────────────────────────────────────────
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
function pickBullets(sentences: string[], n: number): string[] {
  // Dedup while preserving order; cap to n.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sentences) {
    const key = s.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.replace(/^\s*[-*]\s*/, ""));
    if (out.length >= n) break;
  }
  return out;
}
function detectKind(lower: string): string | null {
  for (const { kind, words } of KIND_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return kind;
  }
  return null;
}
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

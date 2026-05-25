import { test } from "node:test";
import assert from "node:assert/strict";

import { deterministicStructure } from "@/lib/ai/coachNotes";
import { mergeNoteIntoProfile, emptyAiProfile } from "@/lib/ai/coachProfile";
import { safeFilename } from "@/lib/storage";

// ── Deterministic structurer ─────────────────────────────────────────────
test("deterministic: ski note picks technical + mental themes from coach prose", () => {
  const s = deterministicStructure({
    sport: "ski",
    rawText:
      "Great session at Saas-Fee. Edges were strong on GS, line was clean. " +
      "Pressure on the outside ski is improving. She was nervous at the start " +
      "but recovered focus by the second run. A bit tired at the end.",
  });
  assert.equal(s.engine, "deterministic");
  assert.equal(s.sport, "ski");
  assert.ok(s.themes.includes("technical"), "technical theme present");
  assert.ok(s.themes.includes("mental"), "mental theme present");
  // Tactical wasn't really discussed — should not be top.
  assert.ok(s.sections.length >= 2, "at least two dynamic sections");
  assert.ok(s.strengths.length > 0, "captures at least one strength");
  assert.ok(s.confidence > 0, "confidence is non-zero");
});

test("deterministic: tennis note picks technical (serve/backhand) + tactical", () => {
  const s = deterministicStructure({
    sport: "tennis",
    rawText:
      "Match against Marco. Serve was inconsistent first set. Backhand patterns improved " +
      "after the change of grip. Tactical placement was clean — strong rally pattern up the line.",
  });
  assert.equal(s.sport, "tennis");
  assert.ok(s.themes.includes("technical"));
  assert.ok(s.themes.includes("tactical"));
  // Match kind is recognised.
  assert.equal(s.detectedKind, "match");
});

test("deterministic: injury cue surfaces in injuryFlags", () => {
  const s = deterministicStructure({
    sport: "ski",
    rawText: "Felt some pain in the right knee after the third run. Iced it; will see physio tomorrow.",
  });
  assert.ok(s.injuryFlags.length > 0, "injury flag captured");
  assert.ok(s.themes.includes("injury"));
});

test("deterministic: empty note returns a safe shape (no throw)", () => {
  const s = deterministicStructure({ sport: "ski", rawText: "" });
  assert.equal(s.engine, "deterministic");
  assert.equal(s.sections.length, 0);
  assert.equal(s.themes.length, 0);
  assert.equal(s.confidence < 0.2, true, "low confidence on empty input");
});

// ── Profile merger ───────────────────────────────────────────────────────
test("mergeNoteIntoProfile: counts themes + bumps recurring weaknesses", () => {
  let profile = null as ReturnType<typeof mergeNoteIntoProfile> | null;
  for (let i = 0; i < 3; i++) {
    const s = deterministicStructure({
      sport: "ski",
      rawText: "Edges weak on left turns. Tired by the end. Doubt creeping in on speed sections.",
    });
    profile = mergeNoteIntoProfile(profile, s, new Date(2026, 0, i + 1));
  }
  const p = profile!;
  assert.equal(p.noteCount, 3);
  // After three notes hitting technical/physical/mental, the counters should be ≥ 3 each.
  assert.ok((p.themeFrequency.technical ?? 0) >= 3);
  // The note has three distinct weakness sentences ("Edges weak…", "Tired…",
  // "Doubt…") — three identical notes ⇒ each entry's count climbs to 3.
  assert.equal(p.recurringWeaknesses.length, 3);
  for (const w of p.recurringWeaknesses) assert.equal(w.count, 3);
});

test("mergeNoteIntoProfile: injury flag marks the trend as 'watch'", () => {
  const s = deterministicStructure({
    sport: "ski",
    rawText: "Pain in the knee, took her out of the last run.",
  });
  const profile = mergeNoteIntoProfile(null, s, new Date(2026, 0, 5));
  assert.ok(profile.injuryFlags.length > 0);
  assert.equal(profile.trends.injury, "watch");
});

// ── Storage helper (pure) ────────────────────────────────────────────────
test("safeFilename: keeps the basics, collapses anything weird to underscore", () => {
  assert.equal(safeFilename("Race report 2026/27.pdf"), "Race_report_2026_27.pdf");
  assert.equal(safeFilename("éàü .docx"), "_.docx");
  assert.equal(safeFilename(""), "file");
  // Cap at 120 chars.
  const long = "a".repeat(200) + ".pdf";
  assert.equal(safeFilename(long).length, 120);
});

test("emptyAiProfile: deterministic shape that survives JSON round-trips", () => {
  const empty = emptyAiProfile(new Date(2026, 0, 1));
  const back = JSON.parse(JSON.stringify(empty));
  assert.equal(back.schemaVersion, 1);
  assert.equal(back.noteCount, 0);
  assert.deepEqual(back.recurringStrengths, []);
});

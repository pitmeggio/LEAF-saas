import { test } from "node:test";
import assert from "node:assert/strict";

import { getSkiProfile, getTennisProfile } from "@/lib/athleteProfile";

// ── Ski accessor ─────────────────────────────────────────────────────────
test("getSkiProfile: legacy columns flow through when no extension table", () => {
  const v = getSkiProfile({ fisCode: "FIS123", fisPoints: 42, worldRank: 88, discipline: "GS" });
  assert.equal(v.fisCode, "FIS123");
  assert.equal(v.fisPoints, 42);
  assert.equal(v.worldRank, 88);
  assert.equal(v.specialty, "GS"); // legacy 'discipline' maps to 'specialty'
});

test("getSkiProfile: extension table wins over legacy columns when present", () => {
  const v = getSkiProfile({
    fisCode: "OLD",
    fisPoints: 99,
    worldRank: 999,
    discipline: "SL",
    skiProfile: { fisCode: "NEW", fisPoints: 12, worldRank: 5, specialty: "DH" },
  });
  assert.equal(v.fisCode, "NEW");
  assert.equal(v.fisPoints, 12);
  assert.equal(v.worldRank, 5);
  assert.equal(v.specialty, "DH");
});

test("getSkiProfile: partial extension data falls back per-field", () => {
  // Only fisPoints lives in the new table; everything else falls back.
  const v = getSkiProfile({
    fisCode: "OLD",
    discipline: "SL",
    skiProfile: { fisCode: null, fisPoints: 7, worldRank: null, specialty: null },
  });
  assert.equal(v.fisCode, "OLD");
  assert.equal(v.fisPoints, 7);
  assert.equal(v.specialty, "SL");
});

// ── Tennis accessor ──────────────────────────────────────────────────────
test("getTennisProfile: legacy columns flow through when no extension table", () => {
  const v = getTennisProfile({
    dominantHand: "right",
    playingStyle: "aggressive baseliner",
    technicalLevel: 7,
    tacticalLevel: 6,
    physicalLevel: 8,
    mentalLevel: 5,
    developmentGoals: "Improve net play",
  });
  assert.equal(v.dominantHand, "right");
  assert.equal(v.playingStyle, "aggressive baseliner");
  assert.equal(v.technicalLevel, 7);
  assert.equal(v.tacticalLevel, 6);
  assert.equal(v.physicalLevel, 8);
  assert.equal(v.mentalLevel, 5);
  assert.equal(v.developmentGoals, "Improve net play");
});

test("getTennisProfile: extension table wins; missing entries return null safely", () => {
  const v = getTennisProfile({
    tennisProfileExt: {
      dominantHand: "left",
      playingStyle: null,
      technicalLevel: 9,
      tacticalLevel: null,
      physicalLevel: null,
      mentalLevel: null,
      developmentGoals: null,
    },
  });
  assert.equal(v.dominantHand, "left");
  assert.equal(v.playingStyle, null);
  assert.equal(v.technicalLevel, 9);
  assert.equal(v.tacticalLevel, null);
});

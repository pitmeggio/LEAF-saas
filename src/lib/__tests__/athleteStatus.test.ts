import { test } from "node:test";
import assert from "node:assert/strict";

import { getAthleteStatus, deriveAthleteCapabilities, athleteStatusLabel } from "@/lib/athleteStatus";

test("getAthleteStatus: enrolled wins over premium", () => {
  // Enrolled athletes get premium for free — the relationship-tier always
  // dominates the subscription-tier when both are true.
  const s = getAthleteStatus({ enrolledAcademiesCount: 1, premiumSubscriber: true });
  assert.equal(s, "enrolled");
});

test("getAthleteStatus: premium without enrolment", () => {
  assert.equal(getAthleteStatus({ enrolledAcademiesCount: 0, premiumSubscriber: true }), "premium");
});

test("getAthleteStatus: free is the default", () => {
  assert.equal(getAthleteStatus({ enrolledAcademiesCount: 0 }), "free");
  assert.equal(getAthleteStatus({ enrolledAcademiesCount: 0, premiumSubscriber: false }), "free");
});

test("deriveAthleteCapabilities: free shows the upgrade CTA, no premium, no academy modules", () => {
  const c = deriveAthleteCapabilities("free");
  assert.equal(c.baseProfile, true);
  assert.equal(c.advancedAi, false);
  assert.equal(c.academyModules, false);
  assert.equal(c.showUpgradeCTA, true);
});

test("deriveAthleteCapabilities: premium unlocks AI but not academy modules", () => {
  const c = deriveAthleteCapabilities("premium");
  assert.equal(c.advancedAi, true);
  assert.equal(c.academyModules, false);
  assert.equal(c.showUpgradeCTA, false);
});

test("deriveAthleteCapabilities: enrolled unlocks everything, no upgrade CTA", () => {
  const c = deriveAthleteCapabilities("enrolled");
  assert.equal(c.advancedAi, true);
  assert.equal(c.academyModules, true);
  assert.equal(c.showUpgradeCTA, false);
});

test("athleteStatusLabel: stable human labels", () => {
  assert.equal(athleteStatusLabel("free"), "Free");
  assert.equal(athleteStatusLabel("premium"), "Premium");
  assert.equal(athleteStatusLabel("enrolled"), "Enrolled · academy member");
});

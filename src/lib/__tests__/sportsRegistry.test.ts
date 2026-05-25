import { test } from "node:test";
import assert from "node:assert/strict";

import { getSportModule, getSportModuleForAcademy, listSportModules } from "@/lib/sports/registry";

test("registry: lists registered sports (ski first as default)", () => {
  const mods = listSportModules();
  assert.ok(mods.length >= 2);
  assert.equal(mods[0].key, "ski");
  assert.ok(mods.some((m) => m.key === "tennis"));
});

test("getSportModule: returns ski + tennis by key", () => {
  assert.equal(getSportModule("ski").label, "Alpine skiing");
  assert.equal(getSportModule("tennis").label, "Tennis");
});

test("getSportModule: unknown / null falls back to default (ski) so UI never crashes", () => {
  assert.equal(getSportModule(null).key, "ski");
  assert.equal(getSportModule(undefined).key, "ski");
  assert.equal(getSportModule("cycling").key, "ski"); // not yet registered
});

test("getSportModuleForAcademy: reads academy.sport with the same fallback", () => {
  assert.equal(getSportModuleForAcademy({ sport: "tennis" }).key, "tennis");
  assert.equal(getSportModuleForAcademy({ sport: null }).key, "ski");
  assert.equal(getSportModuleForAcademy(null).key, "ski");
});

test("capabilities: ski + tennis declare the expected differences", () => {
  const ski = getSportModule("ski");
  const tennis = getSportModule("tennis");
  assert.equal(ski.hasFederationRanking, true);
  assert.equal(tennis.hasFederationRanking, false);
  assert.equal(ski.hasMatchRecord, false);
  assert.equal(tennis.hasMatchRecord, true);
  assert.equal(ski.hasDisciplineSplit, true);
  assert.equal(tennis.hasDisciplineSplit, false);
  assert.equal(tennis.hasDevelopmentLevels, true);
});

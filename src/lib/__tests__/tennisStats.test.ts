import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveTennisStats } from "@/lib/tennisStats";

const m = (date: string, result: "won" | "lost", opponent: string, surface: string | null = null) =>
  ({ date: new Date(date), result, opponent, surface });

test("deriveTennisStats: empty input is safe (no divide-by-zero)", () => {
  const s = deriveTennisStats([]);
  assert.equal(s.total, 0);
  assert.equal(s.winRate, 0);
  assert.equal(s.streak, 0);
  assert.deepEqual(s.recentForm, []);
  assert.deepEqual(s.surfaces, []);
  assert.deepEqual(s.topOpponents, []);
});

test("deriveTennisStats: W/L count + win rate", () => {
  const s = deriveTennisStats([
    m("2026-01-01", "won", "A"),
    m("2026-01-02", "won", "B"),
    m("2026-01-03", "lost", "C"),
    m("2026-01-04", "won", "D"),
  ]);
  assert.equal(s.total, 4);
  assert.equal(s.wins, 3);
  assert.equal(s.losses, 1);
  assert.equal(s.winRate, 75);
});

test("deriveTennisStats: recent form is chronological (oldest → newest)", () => {
  const s = deriveTennisStats([
    m("2026-01-01", "lost", "A"),
    m("2026-01-02", "won", "B"),
    m("2026-01-03", "won", "C"),
    m("2026-01-04", "lost", "D"),
    m("2026-01-05", "won", "E"),
  ]);
  // Latest 5 in chronological order — last entry is the most recent result.
  assert.deepEqual(s.recentForm, ["L", "W", "W", "L", "W"]);
});

test("deriveTennisStats: current streak walks from most recent result", () => {
  // Two losses then three wins (most recent are wins) → streak = +3
  const wins = deriveTennisStats([
    m("2026-01-01", "lost", "A"),
    m("2026-01-02", "lost", "B"),
    m("2026-01-03", "won", "C"),
    m("2026-01-04", "won", "D"),
    m("2026-01-05", "won", "E"),
  ]);
  assert.equal(wins.streak, 3);

  // Three wins then two losses → streak = -2
  const losses = deriveTennisStats([
    m("2026-01-01", "won", "A"),
    m("2026-01-02", "won", "B"),
    m("2026-01-03", "won", "C"),
    m("2026-01-04", "lost", "D"),
    m("2026-01-05", "lost", "E"),
  ]);
  assert.equal(losses.streak, -2);
});

test("deriveTennisStats: surface breakdown buckets unknown + sorts by total", () => {
  const s = deriveTennisStats([
    m("2026-01-01", "won", "A", "hard"),
    m("2026-01-02", "won", "B", "hard"),
    m("2026-01-03", "lost", "C", "hard"),
    m("2026-01-04", "won", "D", "clay"),
    m("2026-01-05", "lost", "E", null),
  ]);
  // Hard is most played → comes first.
  assert.equal(s.surfaces[0].surface, "hard");
  assert.equal(s.surfaces[0].wins, 2);
  assert.equal(s.surfaces[0].losses, 1);
  assert.equal(s.surfaces[0].winRate, 67);
  // Null surface bucketed as "unknown" rather than dropped.
  assert.ok(s.surfaces.some((x) => x.surface === "unknown"));
});

test("deriveTennisStats: top opponents dedup case-insensitive + sort by total", () => {
  const s = deriveTennisStats([
    m("2026-01-01", "won", "Marco Rossi"),
    m("2026-01-02", "lost", "marco rossi"),  // same opponent, different case
    m("2026-01-03", "won", "Anna Bianchi"),
    m("2026-01-04", "won", "Marco Rossi"),
  ]);
  assert.equal(s.topOpponents[0].opponent, "Marco Rossi");
  assert.equal(s.topOpponents[0].wins, 2);
  assert.equal(s.topOpponents[0].losses, 1);
  assert.equal(s.topOpponents[0].total, 3);
  assert.equal(s.topOpponents[1].opponent, "Anna Bianchi");
});

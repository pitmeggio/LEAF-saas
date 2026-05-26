import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeDisciplineBreakdown,
  disciplineHeadline,
  deriveDevelopmentFocus,
} from "@/lib/ai/disciplineAnalytics";

const race = (date: string, discipline: string, rank: number, fisPoints: number, status: "finished" | "dnf" = "finished") =>
  ({ date: new Date(date), discipline, rank, fisPoints, status });

test("breakdown: groups by discipline, ranks by total races", () => {
  const b = computeDisciplineBreakdown([
    race("2026-01-01", "giant_slalom", 12, 35),
    race("2026-01-15", "giant_slalom", 8, 32),
    race("2026-02-01", "giant_slalom", 5, 28),
    race("2026-01-20", "slalom", 22, 50),
    race("2026-02-05", "slalom", 18, 47),
  ]);
  assert.equal(b[0].discipline, "giant_slalom"); // most races → first
  assert.equal(b[0].totalRaces, 3);
  assert.equal(b[1].discipline, "slalom");
});

test("breakdown: detects improving FIS trend (lower-is-better)", () => {
  // 6 races: previous bucket avg 40, recent bucket avg 28 → improving
  const b = computeDisciplineBreakdown([
    race("2025-11-01", "giant_slalom", 25, 42),
    race("2025-11-15", "giant_slalom", 22, 38),
    race("2025-12-01", "giant_slalom", 18, 40),
    race("2026-01-15", "giant_slalom", 10, 30),
    race("2026-02-01", "giant_slalom", 8, 28),
    race("2026-02-15", "giant_slalom", 6, 26),
  ]);
  assert.equal(b[0].fisTrend, "improving");
  assert.ok((b[0].fisDelta ?? 0) < 0);
});

test("breakdown: detects declining FIS trend", () => {
  const b = computeDisciplineBreakdown([
    race("2025-11-01", "slalom", 5, 22),
    race("2025-11-15", "slalom", 6, 24),
    race("2025-12-01", "slalom", 7, 25),
    race("2026-01-15", "slalom", 15, 38),
    race("2026-02-01", "slalom", 18, 40),
    race("2026-02-15", "slalom", 20, 42),
  ]);
  assert.equal(b[0].fisTrend, "declining");
  assert.ok((b[0].fisDelta ?? 0) > 0);
});

test("breakdown: DNF ratio per discipline + global DNF aggregation", () => {
  const b = computeDisciplineBreakdown([
    race("2026-01-01", "slalom", 10, 35),
    race("2026-01-15", "slalom", 0, 35, "dnf"),
    race("2026-02-01", "slalom", 0, 35, "dnf"),
    race("2026-02-15", "slalom", 12, 36),
  ]);
  assert.equal(b[0].dnfPct, 50);
  assert.equal(b[0].dnfCount, 2);
});

test("headline: human-readable per-discipline summary", () => {
  const b = computeDisciplineBreakdown([
    race("2025-11-01", "giant_slalom", 25, 42),
    race("2025-11-15", "giant_slalom", 22, 38),
    race("2025-12-01", "giant_slalom", 18, 40),
    race("2026-01-15", "giant_slalom", 10, 30),
    race("2026-02-01", "giant_slalom", 8, 28),
    race("2026-02-15", "giant_slalom", 6, 26),
  ]);
  const h = disciplineHeadline(b);
  assert.ok(h.includes("GS improving"), h);
});

test("development focus: high DNF triggers race-management focus", () => {
  const b = computeDisciplineBreakdown([
    race("2026-01-01", "slalom", 10, 35),
    race("2026-01-15", "slalom", 0, 35, "dnf"),
    race("2026-02-01", "slalom", 0, 35, "dnf"),
    race("2026-02-15", "slalom", 0, 35, "dnf"),
  ]);
  const focus = deriveDevelopmentFocus(b);
  assert.ok(focus.some((f) => f.area === "race_management"));
});

test("development focus: empty input returns no focus", () => {
  assert.deepEqual(deriveDevelopmentFocus([]), []);
});

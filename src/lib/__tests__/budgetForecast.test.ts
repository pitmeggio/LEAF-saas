import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeGroupBudgetForecast,
  rollupForecasts,
  ZERO_BENCHMARKS,
  daysInclusive,
  type BudgetBenchmarks,
  type GroupInput,
} from "@/lib/budgetForecast";

// Trysil Development Team — Marius's actual Excel translated into benchmarks.
// 8 athletes · 1 head coach · 1 assistant · long travel season.
const TRYSIL_BENCHMARKS: BudgetBenchmarks = {
  ...ZERO_BENCHMARKS,
  pricePerNight: 1000,
  liftPassPerDay: 350,
  mealsPerDay: 0,
  fuelPerTravelDay: 750,
  vanCostAnnual: 252_000,
  housingMonthly: 45_000,
  housingMonthsPerSeason: 8,
  clothingPerAthlete: 8_000,
  headCoachMonthlyRate: 40_000,
  headCoachMonthsPerSeason: 12,
  assistantCoachMonthlyRate: 33_000,
  assistantCoachMonthsPerSeason: 8,
  miscAnnual: 100_000,
  sportOpsAnnual: 100_000,
  defaultTravelDaysPerSeason: 120,
  defaultRaceDaysPerSeason: 100,
  defaultNightsPerSeason: 90,
};

const trysilGroup = (overrides: Partial<GroupInput> = {}): GroupInput => ({
  id: "g_dev",
  name: "Development Team",
  athletesCount: 8,
  headCoachIds: ["c_head"],
  assistantCoachIds: ["c_ass"],
  travelDays: 0,
  trainingDaysOnSnow: 0,
  nights: 0,
  packageRevenue: 4_400_000, // 8 × 550k
  ...overrides,
});

test("forecast: sums every active line into a single total", () => {
  const f = computeGroupBudgetForecast(
    trysilGroup(),
    TRYSIL_BENCHMARKS,
    { totalAthletes: 8, totalGroups: 1, currency: "NOK" },
  );
  // Head + assistant coach
  const head = f.lines.find((l) => l.key === "headCoach");
  const ass = f.lines.find((l) => l.key === "assistantCoach");
  assert.equal(head?.amount, 1 * 12 * 40_000); // 480_000
  assert.equal(ass?.amount, 1 * 8 * 33_000);   // 264_000

  // Housing (8 ath × 8 mo × 45k = 2.88M)
  const housing = f.lines.find((l) => l.key === "housing");
  assert.equal(housing?.amount, 8 * 8 * 45_000);

  // Clothing (8 × 8k = 64k)
  const kit = f.lines.find((l) => l.key === "clothing");
  assert.equal(kit?.amount, 8 * 8_000);

  // Allocated overhead (100% share since group has all athletes)
  const van = f.lines.find((l) => l.key === "vanShare");
  assert.equal(van?.amount, 252_000);

  // Total > 0
  assert.ok(f.totalCost > 0);
  // Income flows through unchanged
  assert.equal(f.forecastIncome, 4_400_000);
  assert.equal(f.forecastNet, 4_400_000 - f.totalCost);
});

test("forecast: skips a line when the rate is zero", () => {
  const noMeals = { ...TRYSIL_BENCHMARKS, mealsPerDay: 0 };
  const f = computeGroupBudgetForecast(
    trysilGroup({ travelDays: 100 }),
    noMeals,
    { totalAthletes: 8, totalGroups: 1, currency: "NOK" },
  );
  assert.equal(f.lines.find((l) => l.key === "meals"), undefined);
});

test("forecast: uses calendar-derived days when present, fallback when empty", () => {
  // With calendar data: 50 nights take precedence over the 90 fallback.
  const withCalendar = computeGroupBudgetForecast(
    trysilGroup({ nights: 50, trainingDaysOnSnow: 60, travelDays: 70 }),
    TRYSIL_BENCHMARKS,
    { totalAthletes: 8, totalGroups: 1, currency: "NOK" },
  );
  const hotelCal = withCalendar.lines.find((l) => l.key === "pricePerNight");
  assert.equal(hotelCal?.amount, 8 * 50 * 1000); // 50 nights from calendar

  // Without calendar: falls back to defaultNightsPerSeason = 90.
  const withoutCalendar = computeGroupBudgetForecast(
    trysilGroup(),
    TRYSIL_BENCHMARKS,
    { totalAthletes: 8, totalGroups: 1, currency: "NOK" },
  );
  const hotelFallback = withoutCalendar.lines.find((l) => l.key === "pricePerNight");
  assert.equal(hotelFallback?.amount, 8 * 90 * 1000);
});

test("forecast: overhead allocated proportionally across groups", () => {
  // Two groups, 8 + 4 athletes → big group eats 8/12 of the van cost.
  const big = computeGroupBudgetForecast(
    trysilGroup({ id: "big", athletesCount: 8 }),
    TRYSIL_BENCHMARKS,
    { totalAthletes: 12, totalGroups: 2, currency: "NOK" },
  );
  const small = computeGroupBudgetForecast(
    trysilGroup({ id: "small", athletesCount: 4, headCoachIds: [], assistantCoachIds: [] }),
    TRYSIL_BENCHMARKS,
    { totalAthletes: 12, totalGroups: 2, currency: "NOK" },
  );

  const bigVan = big.lines.find((l) => l.key === "vanShare")!;
  const smallVan = small.lines.find((l) => l.key === "vanShare")!;
  // 252_000 split 8:4 (rounding tolerated)
  assert.equal(bigVan.amount + smallVan.amount, 252_000);
  assert.ok(bigVan.amount > smallVan.amount);
});

test("rollup: sums totals across forecasts", () => {
  const a = computeGroupBudgetForecast(
    trysilGroup({ id: "a", athletesCount: 8 }),
    TRYSIL_BENCHMARKS,
    { totalAthletes: 8, totalGroups: 1, currency: "NOK" },
  );
  const b = computeGroupBudgetForecast(
    trysilGroup({ id: "b", athletesCount: 0, headCoachIds: [], assistantCoachIds: [], packageRevenue: 0 }),
    TRYSIL_BENCHMARKS,
    { totalAthletes: 8, totalGroups: 2, currency: "NOK" },
  );
  const r = rollupForecasts([a, b]);
  assert.equal(r.totalCost, a.totalCost + b.totalCost);
  assert.equal(r.totalIncome, a.forecastIncome + b.forecastIncome);
  assert.equal(r.groupCount, 2);
});

test("daysInclusive: same-day event is 1 day, no end-date defaults to 1 day", () => {
  const d1 = new Date("2026-01-15");
  const d2 = new Date("2026-01-20");
  assert.equal(daysInclusive(d1, d1), 1);
  assert.equal(daysInclusive(d1, d2), 6); // 15,16,17,18,19,20 = 6 days
  assert.equal(daysInclusive(d1, null), 1);
});

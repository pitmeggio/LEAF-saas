import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGroupBudgetForecast, type BudgetBenchmarks } from "@/lib/budgetForecast";

// Regression lock: the LEAF forecast must reproduce Marius's actual
// Trysil Development-Team Excel down to the line item. If anyone tweaks
// engine math, this test fails -- and the demo loses its credibility.
//
// Source: /Users/pietromeggiolaro/Desktop/DEV full bud.xlsx
// Sheet: "Dev Team Model"
//
// Inputs (left column):              Results (right column):
//   antall utøvere     = 8             Total inntekter   = 4,400,000
//   pris per utøver    = 550,000       Hovedtrener       =   480,000
//   antall personer    = 10            Ass trener        =   264,000
//   reisedager         = 120           Bolig             =   360,000
//   pris per natt      = 1,000         Overnatting       = 1,200,000
//   heiskort per dag   = 350           Heiskort          =   420,000
//   drivstoff (reise)  = 90,000        Drivstoff         =    90,000
//   bilkost fast       = 252,000       Biler             =   252,000
//   hovedtrener mnd    = 40,000        Klær              =    80,000
//   ass trener mnd     = 33,000        Sport/drift       =   100,000
//   bolig per mnd      = 45,000        Diverse           =   100,000
//   klær per person    = 8,000         Total kostnader   = 3,346,000
//   diverse            = 100,000       RESULTAT (net)    = 1,054,000
//   sport/drift        = 100,000

const TRYSIL_BENCH: BudgetBenchmarks = {
  pricePerNight: 1000,
  liftPassPerDay: 350,
  mealsPerDay: 0,
  fuelPerTravelDay: 750,       // 90,000 / 120 = 750 / day
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
  defaultRaceDaysPerSeason: 120,
  defaultNightsPerSeason: 0,
};

const fullPackage = { accommodation: true, transport: true, coaching: true, raceSupport: true };

test("Marius's Excel: Development Team forecast matches to the krone", () => {
  const enrollments = Array.from({ length: 8 }, () => fullPackage);
  const f = computeGroupBudgetForecast(
    {
      id: "dev",
      name: "Development",
      athletesCount: 8,
      enrollments,
      headCoachIds: ["head"],
      assistantCoachIds: ["assistant"],
      travelDays: 120,
      trainingDaysOnSnow: 120,
      nights: 0,           // unused now — engine bills hotel per travel day
      packageRevenue: 4_400_000,
    },
    TRYSIL_BENCH,
    { totalAthletes: 8, totalGroups: 1, currency: "NOK" },
  );
  const lineByKey = Object.fromEntries(f.lines.map((l) => [l.key, l.amount]));
  assert.equal(lineByKey.headCoach, 480_000, "Hovedtrener");
  assert.equal(lineByKey.assistantCoach, 264_000, "Ass trener");
  assert.equal(lineByKey.pricePerNight, 1_200_000, "Overnatting");
  assert.equal(lineByKey.housing, 360_000, "Bolig");
  assert.equal(lineByKey.liftPass, 420_000, "Heiskort");
  assert.equal(lineByKey.fuel, 90_000, "Drivstoff");
  assert.equal(lineByKey.vanShare, 252_000, "Biler");
  assert.equal(lineByKey.clothing, 80_000, "Klær");
  assert.equal(lineByKey.sportOpsShare, 100_000, "Sport/drift");
  assert.equal(lineByKey.miscShare, 100_000, "Diverse");
  assert.equal(f.totalCost, 3_346_000, "Total kostnader");
  assert.equal(f.forecastIncome, 4_400_000, "Total inntekter");
  assert.equal(f.forecastNet, 1_054_000, "RESULTAT");
});

test("Marius's Excel: Tech-Elite (paying athletes, no accommodation) costs only coach + ops", () => {
  // Hypothetical tech-elite roster of 4 self-financing athletes on the
  // Training-only package: no accommodation, no transport, no race
  // support — academy pays only the coach + the academy-wide overhead
  // share. Engine should produce zero hotel / housing / lift pass / fuel.
  const trainingOnly = { accommodation: false, transport: false, coaching: true, raceSupport: false };
  const enrollments = Array.from({ length: 4 }, () => trainingOnly);
  const f = computeGroupBudgetForecast(
    {
      id: "tech",
      name: "Tech Elite",
      athletesCount: 4,
      enrollments,
      headCoachIds: ["head"],
      assistantCoachIds: [],
      travelDays: 120,
      trainingDaysOnSnow: 120,
      nights: 0,
      packageRevenue: 4 * 139_000,
    },
    TRYSIL_BENCH,
    { totalAthletes: 12, totalGroups: 2, currency: "NOK" },
  );
  const keys = new Set(f.lines.map((l) => l.key));
  // Tech-Elite athletes don't trigger accommodation lines, but the head
  // coach travelling with the team still does — that's correct.
  assert.ok(keys.has("headCoach"), "head coach line should be present");
  assert.ok(keys.has("clothing"), "coach still gets team kit");
  // Hotel / housing / lift pass exist because the coach travels.
  // The key check is that they're sized by 1 coach, not 4 athletes.
  const hotel = f.lines.find((l) => l.key === "pricePerNight");
  assert.ok(hotel && hotel.amount === 1 * 120 * 1000, "hotel only for coach: 1 × 120 × 1000");
});

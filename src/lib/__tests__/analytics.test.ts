import { test } from "node:test";
import assert from "node:assert/strict";

import { computePerformance } from "@/lib/performance";
import { forecastTrajectory } from "@/lib/ai/forecast";
import { academyHealth } from "@/lib/ai/academyHealth";
import { suggestGroups, type GroupInput } from "@/lib/ai/groupAssignment";
import { reviewApplication } from "@/lib/ai/applicationReview";
import { buildPaymentSchedule, resolveRequiredDocs } from "@/lib/enrollmentLogic";
import { aggregateFinance, type PaymentLike } from "@/lib/financeMath";
import { seasonKpis, seasonHints, eventTotalCost, eventCoversDay, type EventLite } from "@/lib/planning";

// ── Performance analytics (athlete results) ──────────────────────────────────
test("computePerformance: empty input is safe (no divide-by-zero)", () => {
  const p = computePerformance([], []);
  assert.equal(p.totalRaces, 0);
  assert.equal(p.finishes, 0);
  assert.equal(p.bestFinish, null);
  assert.equal(p.podiumPct, 0);
  assert.equal(p.dnfPct, 0);
  assert.equal(p.consistency.score, null);
});

test("computePerformance: rates + consistency from a known set", () => {
  const d = (s: string) => new Date(s);
  const p = computePerformance(
    [
      { date: d("2025-01-01"), discipline: "SL", rank: 1, fisPoints: 20, status: "finished" },
      { date: d("2025-01-08"), discipline: "SL", rank: 3, fisPoints: 22, status: "finished" },
      { date: d("2025-01-15"), discipline: "GS", rank: 5, fisPoints: 30, status: "finished" },
      { date: d("2025-01-22"), discipline: "GS", rank: 0, fisPoints: 0, status: "dnf" },
    ],
    [],
  );
  assert.equal(p.totalRaces, 4);
  assert.equal(p.finishes, 3);
  assert.equal(p.dnfCount, 1);
  assert.equal(p.dnfPct, 25); // 1/4
  assert.equal(p.bestFinish, 1);
  assert.equal(p.podiumCount, 2); // ranks 1 and 3
  assert.equal(p.podiumPct, 67); // round(2/3)
  assert.equal(p.consistency.avgFinish, 3); // mean of [1,3,5]
  assert.equal(p.consistency.score, 46); // 100 - CV*100
  assert.equal(p.disciplineSplit.length, 2);
});

// ── Forecast (least-squares projection, sport-aware) ─────────────────────────
test("forecastTrajectory: needs >=3 points", () => {
  const f = forecastTrajectory([{ label: "a", fisPoints: 50 }, { label: "b", fisPoints: 45 }], "ski");
  assert.equal(f.enoughData, false);
  assert.equal(f.projectedPoints, null);
});

test("forecastTrajectory: ski lower-is-better → falling points = improving", () => {
  const f = forecastTrajectory(
    [{ label: "a", fisPoints: 50 }, { label: "b", fisPoints: 45 }, { label: "c", fisPoints: 40 }, { label: "d", fisPoints: 35 }],
    "ski",
  );
  assert.equal(f.enoughData, true);
  assert.equal(f.improving, true);
  assert.ok(f.projectedPoints! < f.currentPoints!); // projecting further down
  assert.ok(f.deltaPoints! < 0);
});

// ── Academy health (collection + retention rates) ────────────────────────────
test("academyHealth: collection + retention rates", () => {
  const h = academyHealth({
    collected: 900,
    outstandingTotal: 100,
    overdueTotal: 50,
    mrr: 1000,
    unpaidAthletes: 1,
    occupancyPct: 80,
    statuses: ["active", "active", "inactive"],
    fmt: (n) => `€${n}`,
  });
  assert.equal(h.collectionRate, 90); // 900 / (900+100)
  assert.equal(h.retentionRate, 67); // 2 retained / 3
  assert.equal(h.revenueAtRisk, 50);
});

// ── Smart group assignment ───────────────────────────────────────────────────
test("suggestGroups: picks the eligible in-band group, rejects wrong sport", () => {
  const groups: GroupInput[] = [
    { id: "fit", name: "Fit", sport: "ski", capacity: 10, enrolledCount: 2, pointsMin: 20, pointsMax: 40, ageMin: 15, ageMax: 18, discipline: null, level: "competitive" },
    { id: "tennis", name: "Tennis", sport: "tennis", capacity: 10, enrolledCount: 0, pointsMin: null, pointsMax: null, ageMin: null, ageMax: null, discipline: null, level: null },
    { id: "wrongband", name: "Elite", sport: "ski", capacity: 10, enrolledCount: 0, pointsMin: 50, pointsMax: 80, ageMin: null, ageMax: null, discipline: null, level: "elite" },
  ];
  const s = suggestGroups({ sport: "ski", points: 30, age: 17, discipline: "SL" }, groups);
  const rec = s.find((x) => x.recommended);
  assert.equal(rec?.groupId, "fit");
  assert.equal(s.find((x) => x.groupId === "tennis")!.eligible, false);
});

// ── Application review (fit score + risk flags) ──────────────────────────────
test("reviewApplication: minor without guardian raises a high-severity flag", () => {
  const r = reviewApplication({
    sport: "ski", age: 15, verified: true, hasFederationCode: true,
    resultsCount: 6, finishedCount: 6, dnfCount: 0, podiumCount: 2,
    recentRaces12m: 8, trendDeltaPoints: -3, guardianProvided: false, bestGroupFit: 80,
  });
  assert.ok(r.fitScore >= 70);
  assert.equal(r.band, "strong");
  assert.ok(r.flags.some((f) => f.severity === "high" && /guardian/i.test(f.label)));
});

// ── Payment schedule (only used in LEAF-managed mode) ────────────────────────
test("buildPaymentSchedule: installments always sum back to the price", () => {
  const join = new Date("2025-01-01");
  for (const billingFreq of ["one_time", "monthly", "seasonal"]) {
    const sched = buildPaymentSchedule({ price: 1000, currency: "EUR", billingFreq, joinDate: join });
    const sum = sched.reduce((s, p) => s + p.amount, 0);
    assert.equal(sum, billingFreq === "monthly" ? 6000 : 1000, `sum for ${billingFreq}`);
  }
  assert.equal(buildPaymentSchedule({ price: 1000, currency: "EUR", billingFreq: "seasonal", joinDate: join }).length, 3);
  assert.equal(buildPaymentSchedule({ price: 0, currency: "EUR", billingFreq: "seasonal", joinDate: join }).length, 0);
});

// ── Required documents config ────────────────────────────────────────────────
test("resolveRequiredDocs: falls back to default, filters junk", () => {
  assert.equal(resolveRequiredDocs(null).length, 4);
  assert.deepEqual(resolveRequiredDocs("medical_certificate, travel"), ["medical_certificate", "travel"]);
  assert.equal(resolveRequiredDocs("nonsense, garbage").length, 4); // unknown keys → default
});

// ── Finance aggregation (multi-currency, partials, overdue, real MRR) ─────────
test("aggregateFinance: never mixes currencies; base headline + partials + overdue + MRR", () => {
  const now = new Date("2025-06-15");
  const d = (s: string) => new Date(s);
  const payments: PaymentLike[] = [
    { amount: 1000, paidAmount: 1000, currency: "EUR", dueDate: d("2025-05-01"), paidDate: d("2025-06-10"), status: "paid" },
    { amount: 1000, paidAmount: 0, currency: "EUR", dueDate: d("2025-05-01"), paidDate: null, status: "unpaid" }, // overdue
    { amount: 500, paidAmount: 200, currency: "EUR", dueDate: d("2025-12-01"), paidDate: d("2025-06-12"), status: "partial" }, // not overdue (future due)
    { amount: 2000, paidAmount: 2000, currency: "USD", dueDate: d("2025-05-01"), paidDate: d("2025-06-01"), status: "paid" }, // other currency
  ];
  const a = aggregateFinance(payments, { baseCurrency: "EUR", now });

  assert.equal(a.currency, "EUR");
  assert.equal(a.collected, 1200); // 1000 + 200 (USD excluded)
  assert.equal(a.billed, 2500);
  assert.equal(a.outstandingTotal, 1300); // 1000 unpaid + 300 partial
  assert.equal(a.overdueTotal, 1000); // only the past-due unpaid one
  assert.equal(a.paidThisMonth, 1200); // both June collections
  assert.equal(a.collectionRate, 48); // 1200 / 2500
  assert.equal(a.monthlyRecurring, 400); // 1200 collected in last 90d / 3
  // The USD money is segregated, never summed into the EUR headline.
  assert.equal(a.otherCurrencies.length, 1);
  assert.equal(a.otherCurrencies[0].currency, "USD");
  assert.equal(a.otherCurrencies[0].collected, 2000);
});

// ── Season planner KPIs + AI hints + event cost rules ───────────────────────
const ev = (over: Partial<EventLite> = {}): EventLite => ({
  id: "x", title: "t", type: "camp", season: "all",
  startDate: "2026-09-01T00:00:00Z", endDate: "2026-09-05T00:00:00Z",
  location: null, planBLocation: null, discipline: null, coachesNote: null, notes: null,
  groupId: null, groupName: null, estimatedCost: null, actualCost: null,
  costHotel: 0, costFlights: 0, costVan: 0, costFuel: 0, costLiftPass: 0,
  costCoach: 0, costAccommodation: 0, costRaceFees: 0, costMisc: 0,
  ...over,
});

test("eventTotalCost: actual > estimate > breakdown precedence", () => {
  assert.equal(eventTotalCost(ev({ costHotel: 1000, costFuel: 500 })), 1500); // breakdown
  assert.equal(eventTotalCost(ev({ costHotel: 1000, estimatedCost: 2000 })), 2000); // override
  assert.equal(eventTotalCost(ev({ costHotel: 1000, estimatedCost: 2000, actualCost: 1800 })), 1800); // actual wins
});

test("eventCoversDay: inclusive across the event window", () => {
  const e = ev({ startDate: "2026-09-01T00:00:00Z", endDate: "2026-09-03T00:00:00Z" });
  assert.equal(eventCoversDay(e, new Date("2026-09-01")), true);
  assert.equal(eventCoversDay(e, new Date("2026-09-02")), true);
  assert.equal(eventCoversDay(e, new Date("2026-09-03")), true);
  assert.equal(eventCoversDay(e, new Date("2026-08-31")), false);
  assert.equal(eventCoversDay(e, new Date("2026-09-04")), false);
});

test("seasonKpis + hints: forecast over remaining triggers a warning", () => {
  const now = new Date("2026-08-15");
  const events = [
    ev({ startDate: "2026-09-01", endDate: "2026-09-05", type: "camp", estimatedCost: 60000 }),
    ev({ startDate: "2026-08-20", endDate: "2026-08-22", type: "travel", estimatedCost: 5000 }),
    ev({ startDate: "2025-07-01", endDate: "2025-07-05", type: "camp", estimatedCost: 99999 }), // past → excluded
  ];
  const k = seasonKpis({ totalBudget: 100000, spent: 20000, events, now });
  assert.equal(k.remaining, 80000);
  assert.equal(k.forecasted, 65000);
  assert.equal(k.upcomingTravel, 65000); // travel + camp + race within 30 days
  assert.equal(k.budgetRiskPct, Math.round((65000 / 80000) * 100)); // 81

  const overEvents = [...events, ev({ startDate: "2026-09-10", type: "camp", estimatedCost: 50000 })];
  const k2 = seasonKpis({ totalBudget: 100000, spent: 20000, events: overEvents, now });
  assert.ok(k2.budgetRiskPct >= 100);
  const hints = seasonHints(k2, (n) => `${n} EUR`);
  assert.ok(hints.some((h) => h.kind === "warn" && /exceeds remaining/.test(h.text)));
});

test("aggregateFinance: base currency with no payments yields zeroed headline", () => {
  const a = aggregateFinance([{ amount: 100, paidAmount: 100, currency: "USD", dueDate: new Date(), paidDate: new Date(), status: "paid" }], { baseCurrency: "NOK", now: new Date() });
  assert.equal(a.currency, "NOK");
  assert.equal(a.collected, 0);
  assert.equal(a.collectionRate, 100);
  assert.equal(a.otherCurrencies[0].currency, "USD");
});

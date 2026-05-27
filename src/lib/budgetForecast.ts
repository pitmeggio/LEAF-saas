// Budget forecast engine — auto-derives a per-group, per-season cost forecast
// from the data the academy already keeps in LEAF (roster, calendar events,
// coach roster) multiplied by the per-academy AcademyBudgetBenchmarks rates.
//
// Marius's reality (Trysil): he doesn't want to type 17 numbers per group
// into a spreadsheet. He wants the platform to say "this team will cost
// 3.2M NOK this season — here's the math". This engine is that math.
//
// Architecture:
//   • Pure deterministic math, no DB/Prisma imports. Inputs are plain data
//     so this file is trivially testable and reusable from server actions,
//     pages, or batch jobs.
//   • Query layer lives in `src/lib/ops.ts` (`getBudgetForecastForAcademy`)
//     and feeds this engine the shapes it needs.
//   • Currency is interpreted in Academy.currency — values are major units
//     (NOK 1000, not øre).
//
// Adding a new sport that has different cost drivers? Add a new optional
// rate to AcademyBudgetBenchmarks + a new line item below. The engine
// already skips line items with a zero rate, so unused fields stay invisible.

export type BudgetBenchmarks = {
  pricePerNight: number;
  liftPassPerDay: number;
  mealsPerDay: number;
  fuelPerTravelDay: number;
  vanCostAnnual: number;
  housingMonthly: number;
  housingMonthsPerSeason: number;
  clothingPerAthlete: number;
  headCoachMonthlyRate: number;
  headCoachMonthsPerSeason: number;
  assistantCoachMonthlyRate: number;
  assistantCoachMonthsPerSeason: number;
  miscAnnual: number;
  sportOpsAnnual: number;
  defaultTravelDaysPerSeason: number;
  defaultRaceDaysPerSeason: number;
  defaultNightsPerSeason: number;
};

// Per-athlete cost coverage, derived from each enrolment's PACKAGE flags.
// Each athlete only counts toward a cost line if their package opted in:
//   • accommodation → hotel nights + base-camp housing + meals
//   • transport     → fuel + vehicle share
//   • coaching      → kit + per-athlete overhead share
//   • raceSupport   → lift pass + race-day operations
// This is what makes Trysil's Tech-Elite team (paying-athletes, no
// accommodation included) genuinely cheaper than Development (academy
// covers travel + housing) even on the same season calendar.
export type EnrolledAthlete = {
  accommodation: boolean;
  transport: boolean;
  coaching: boolean;
  raceSupport: boolean;
};

export type GroupInput = {
  id: string;
  name: string;
  athletesCount: number;
  // One entry per active athlete on the team. Optional for legacy callers
  // (and unit tests) that pre-date per-package coverage; the engine then
  // treats every athlete as fully covered to preserve previous semantics.
  enrollments?: EnrolledAthlete[];
  headCoachIds: string[];          // coach IDs flagged as head_coach assigned to this group
  assistantCoachIds: string[];     // coach IDs flagged as assistant or other roles
  // Counted in days, derived from CalendarEvent.startDate/endDate where event.groupId
  // matches and event.type is in the relevant bucket. The query layer does the work
  // — see getBudgetForecastForAcademy in lib/ops.ts.
  travelDays: number;              // type ∈ {camp, race, travel}
  trainingDaysOnSnow: number;      // type ∈ {training, camp, race}
  nights: number;                  // sum of max(0, days-1) for multi-day events
  packageRevenue: number;          // Σ package.price for active enrollments
};

export type AcademyInput = {
  totalAthletes: number;           // for share-of-academy allocation of overheads
  totalGroups: number;
  currency: string;
};

// A single line in the per-group breakdown. `formula` is the human-friendly
// explanation that powers the tooltip on the UI — change carefully, the
// shape is also how a coach sanity-checks the number.
export type ForecastLine = {
  key: string;
  label: string;
  formula: string;
  amount: number;
  category: "staff" | "travel" | "lodging" | "ops" | "overhead";
};

export type GroupForecast = {
  groupId: string;
  groupName: string;
  athletesCount: number;
  lines: ForecastLine[];
  totalCost: number;
  forecastIncome: number;
  forecastNet: number;
};

// Compute the forecast for a single group. The function is pure — it never
// looks at the DB. Pass in the rates + the group's pre-computed quantities
// (the query layer is responsible for those).
export function computeGroupBudgetForecast(
  group: GroupInput,
  benchmarks: BudgetBenchmarks,
  academy: AcademyInput,
): GroupForecast {
  const lines: ForecastLine[] = [];

  // Effective days: prefer calendar-derived values; fall back to the per-academy
  // defaults so day-1 academies (calendar still empty) get a sensible number.
  const travelDays = group.travelDays > 0 ? group.travelDays : benchmarks.defaultTravelDaysPerSeason;
  const trainingDays = group.trainingDaysOnSnow > 0 ? group.trainingDaysOnSnow : benchmarks.defaultRaceDaysPerSeason;
  const nights = group.nights > 0 ? group.nights : benchmarks.defaultNightsPerSeason;
  const n = group.athletesCount;

  // Per-cost-line athlete counts derived from each enrolment's package
  // flags. A Tech-Elite roster on "Academy Training" (no accommodation)
  // produces accNum = 0 and pays zero hotel/housing/meals — the cost lines
  // simply don't appear. A Development roster on "Academy Full Year"
  // produces accNum = athletesCount and pays the full board. This is the
  // single change that makes the forecast honest across team tiers.
  const enr = group.enrollments ?? [];
  const accNum = enr.filter((e) => e.accommodation).length;
  const transNum = enr.filter((e) => e.transport).length;
  const coachNum = enr.filter((e) => e.coaching).length;
  const raceNum = enr.filter((e) => e.raceSupport).length;
  // Fallback: when no enrolment metadata is available (legacy caller),
  // treat every athlete as fully covered so the engine doesn't silently
  // zero out a team's costs.
  const fallback = enr.length === 0;
  const accAth = fallback ? n : accNum;
  const transAth = fallback ? n : transNum;
  const coachAth = fallback ? n : coachNum;
  const raceAth = fallback ? n : raceNum;

  // Coaches travel WITH the team — they sleep in the hotel, eat with the
  // athletes, ski the lift pass. Marius's spreadsheet uses "antall
  // personer totalt = 10" (8 athletes + 2 coaches) for these lines, not
  // just athletes. We mirror that: persons on trip = covered athletes
  // PLUS the team's coaches.
  const teamCoaches = group.headCoachIds.length + group.assistantCoachIds.length;
  const tripPersons = accAth + teamCoaches;      // hotel / meals
  const racePersons = raceAth + teamCoaches;     // lift pass
  const kitPersons = coachAth + teamCoaches;     // team uniform

  // ── Staff ────────────────────────────────────────────────────────────────
  if (group.headCoachIds.length > 0 && benchmarks.headCoachMonthlyRate > 0) {
    const months = benchmarks.headCoachMonthsPerSeason;
    const amount = group.headCoachIds.length * benchmarks.headCoachMonthlyRate * months;
    lines.push({
      key: "headCoach",
      label: "Head coach",
      formula: `${group.headCoachIds.length} × ${months} mo × ${benchmarks.headCoachMonthlyRate}`,
      amount,
      category: "staff",
    });
  }
  if (group.assistantCoachIds.length > 0 && benchmarks.assistantCoachMonthlyRate > 0) {
    const months = benchmarks.assistantCoachMonthsPerSeason;
    const amount = group.assistantCoachIds.length * benchmarks.assistantCoachMonthlyRate * months;
    lines.push({
      key: "assistantCoach",
      label: "Assistant coach",
      formula: `${group.assistantCoachIds.length} × ${months} mo × ${benchmarks.assistantCoachMonthlyRate}`,
      amount,
      category: "staff",
    });
  }

  // ── Lodging — hotel uses travel DAYS (not nights) and counts persons
  //    (covered athletes + coaches that travel with the team), matching
  //    the way alpine academy models actually book hotels. Housing is
  //    FLAT per team (the academy rents one apartment for the squad).
  if (tripPersons > 0 && benchmarks.pricePerNight > 0 && travelDays > 0) {
    const amount = tripPersons * travelDays * benchmarks.pricePerNight;
    lines.push({
      key: "pricePerNight",
      label: "Hotel / lodge",
      formula: `${tripPersons} persons (${accAth}/${n} ath + ${teamCoaches} coach) × ${travelDays} days × ${benchmarks.pricePerNight}`,
      amount,
      category: "lodging",
    });
  }
  if (benchmarks.housingMonthly > 0 && benchmarks.housingMonthsPerSeason > 0 && (accAth > 0 || teamCoaches > 0)) {
    const months = benchmarks.housingMonthsPerSeason;
    const amount = benchmarks.housingMonthly * months;
    lines.push({
      key: "housing",
      label: "Base-camp housing (team apartment)",
      formula: `${months} mo × ${benchmarks.housingMonthly}`,
      amount,
      category: "lodging",
    });
  }

  // ── Travel / on-snow — race support drives lift pass; accommodation
  //    drives meals on the road; transport drives the van/fuel share.
  if (racePersons > 0 && benchmarks.liftPassPerDay > 0 && trainingDays > 0) {
    const amount = racePersons * trainingDays * benchmarks.liftPassPerDay;
    lines.push({
      key: "liftPass",
      label: "Lift pass",
      formula: `${racePersons} persons (${raceAth}/${n} ath + ${teamCoaches} coach) × ${trainingDays} days × ${benchmarks.liftPassPerDay}`,
      amount,
      category: "travel",
    });
  }
  if (tripPersons > 0 && benchmarks.mealsPerDay > 0 && travelDays > 0) {
    const amount = tripPersons * travelDays * benchmarks.mealsPerDay;
    lines.push({
      key: "meals",
      label: "Meals",
      formula: `${tripPersons} persons × ${travelDays} days × ${benchmarks.mealsPerDay}`,
      amount,
      category: "travel",
    });
  }
  // Fuel + the van are per-team costs (not per-athlete) but only apply
  // when at least one athlete on the team is on the transport plan OR
  // there are coaches travelling with the team. Otherwise the team is
  // meeting at events under their own steam.
  if ((transAth > 0 || teamCoaches > 0) && benchmarks.fuelPerTravelDay > 0 && travelDays > 0) {
    const amount = travelDays * benchmarks.fuelPerTravelDay;
    lines.push({
      key: "fuel",
      label: "Fuel (team van)",
      formula: `${travelDays} travel days × ${benchmarks.fuelPerTravelDay}`,
      amount,
      category: "travel",
    });
  }

  // ── Per-athlete ops — kit goes to anyone with a coaching plan plus the
  //    coaches themselves (they wear the team uniform too).
  if (kitPersons > 0 && benchmarks.clothingPerAthlete > 0) {
    const amount = kitPersons * benchmarks.clothingPerAthlete;
    lines.push({
      key: "clothing",
      label: "Team kit",
      formula: `${kitPersons} persons (${coachAth}/${n} ath + ${teamCoaches} coach) × ${benchmarks.clothingPerAthlete}`,
      amount,
      category: "ops",
    });
  }

  // ── Allocated academy overheads (share by athletes) ──────────────────────
  // The van, misc and sport-ops costs are academy-wide. We allocate them to
  // groups in proportion to athlete share so each team's P&L is honest.
  if (academy.totalAthletes > 0) {
    const share = n / academy.totalAthletes;
    // The team van is only relevant for athletes on a transport plan —
    // pure paying athletes who travel with their family don't move the
    // share of academy vehicle costs allocated to this team.
    if (benchmarks.vanCostAnnual > 0 && transAth > 0) {
      const transportShare = transAth / academy.totalAthletes;
      const amount = Math.round(benchmarks.vanCostAnnual * transportShare);
      lines.push({
        key: "vanShare",
        label: "Vehicle costs (allocated)",
        formula: `${benchmarks.vanCostAnnual} × ${(transportShare * 100).toFixed(0)}% (${transAth}/${academy.totalAthletes} transported ath)`,
        amount,
        category: "overhead",
      });
    }
    if (benchmarks.sportOpsAnnual > 0) {
      const amount = Math.round(benchmarks.sportOpsAnnual * share);
      lines.push({
        key: "sportOpsShare",
        label: "Sport ops (allocated)",
        formula: `${benchmarks.sportOpsAnnual} × ${(share * 100).toFixed(0)}%`,
        amount,
        category: "overhead",
      });
    }
    if (benchmarks.miscAnnual > 0) {
      const amount = Math.round(benchmarks.miscAnnual * share);
      lines.push({
        key: "miscShare",
        label: "Misc (allocated)",
        formula: `${benchmarks.miscAnnual} × ${(share * 100).toFixed(0)}%`,
        amount,
        category: "overhead",
      });
    }
  }

  const totalCost = lines.reduce((sum, l) => sum + l.amount, 0);
  const forecastIncome = group.packageRevenue;
  const forecastNet = forecastIncome - totalCost;

  return {
    groupId: group.id,
    groupName: group.name,
    athletesCount: n,
    lines,
    totalCost,
    forecastIncome,
    forecastNet,
  };
}

// Compute the academy-wide rollup from a list of group forecasts.
// Same shape as a single group, just summed — handy for the page totals row.
export function rollupForecasts(forecasts: GroupForecast[]) {
  const totalCost = forecasts.reduce((s, f) => s + f.totalCost, 0);
  const totalIncome = forecasts.reduce((s, f) => s + f.forecastIncome, 0);
  const totalAthletes = forecasts.reduce((s, f) => s + f.athletesCount, 0);
  return {
    totalCost,
    totalIncome,
    totalNet: totalIncome - totalCost,
    totalAthletes,
    groupCount: forecasts.length,
  };
}

// Default benchmarks for a brand-new academy. Used when the row hasn't been
// upserted yet so the page shows useful zeros rather than crashing.
export const ZERO_BENCHMARKS: BudgetBenchmarks = {
  pricePerNight: 0,
  liftPassPerDay: 0,
  mealsPerDay: 0,
  fuelPerTravelDay: 0,
  vanCostAnnual: 0,
  housingMonthly: 0,
  housingMonthsPerSeason: 8,
  clothingPerAthlete: 0,
  headCoachMonthlyRate: 0,
  headCoachMonthsPerSeason: 12,
  assistantCoachMonthlyRate: 0,
  assistantCoachMonthsPerSeason: 8,
  miscAnnual: 0,
  sportOpsAnnual: 0,
  defaultTravelDaysPerSeason: 0,
  defaultRaceDaysPerSeason: 0,
  defaultNightsPerSeason: 0,
};

// Days inclusive between two dates (start === end → 1 day). Public helper
// so the query layer can stay consistent with the engine's expectation.
export function daysInclusive(start: Date, end: Date | null | undefined): number {
  const e = end ?? start;
  const ms = Math.max(0, e.getTime() - start.getTime());
  return Math.floor(ms / (24 * 3600 * 1000)) + 1;
}

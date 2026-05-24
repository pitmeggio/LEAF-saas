// Pure planning math — KPIs, day helpers, deterministic AI hints.
// DB-free so it can be unit-tested independently.

export type EventLite = {
  id: string;
  title: string;
  type: string; // training | camp | race | travel | meeting | off | other
  season: string;
  startDate: string; // ISO
  endDate: string | null;
  location: string | null;
  planBLocation: string | null;
  discipline: string | null;
  coachesNote: string | null;
  notes: string | null;
  groupId: string | null;
  groupName: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  costHotel: number; costFlights: number; costVan: number; costFuel: number;
  costLiftPass: number; costCoach: number; costAccommodation: number;
  costRaceFees: number; costMisc: number;
};

export function eventBreakdownTotal(e: EventLite): number {
  return e.costHotel + e.costFlights + e.costVan + e.costFuel + e.costLiftPass +
    e.costCoach + e.costAccommodation + e.costRaceFees + e.costMisc;
}

// The headline "this event will cost" — actual takes priority, then explicit
// estimate, then the sum of the breakdown rows.
export function eventTotalCost(e: EventLite): number {
  if (e.actualCost != null) return e.actualCost;
  if (e.estimatedCost != null) return e.estimatedCost;
  return eventBreakdownTotal(e);
}

// Inclusive — does the event cover this date (any time of day)?
export function eventCoversDay(e: EventLite, day: Date): boolean {
  const start = new Date(e.startDate); start.setHours(0, 0, 0, 0);
  const end = new Date(e.endDate ?? e.startDate); end.setHours(23, 59, 59, 999);
  const d = new Date(day); d.setHours(12, 0, 0, 0);
  return +d >= +start && +d <= +end;
}

export function daysOfMonth(year: number, monthIdx0: number): Date[] {
  const out: Date[] = [];
  const date = new Date(year, monthIdx0, 1);
  while (date.getMonth() === monthIdx0) {
    out.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return out;
}

// ISO 8601 week number (week 1 = week containing Jan 4th).
export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
}

export type SeasonKpis = {
  totalBudget: number;
  spent: number;
  remaining: number;
  forecasted: number;       // upcoming events' total cost
  upcomingTravel: number;   // travel/camp/race cost in next 30 days
  budgetRiskPct: number;    // forecasted / remaining * 100 (>100 = exposure)
};

export function seasonKpis(opts: { totalBudget: number; spent: number; events: EventLite[]; now?: Date }): SeasonKpis {
  const now = opts.now ?? new Date();
  const upcoming = opts.events.filter((e) => +new Date(e.endDate ?? e.startDate) >= +now);
  const forecasted = upcoming.reduce((s, e) => s + eventTotalCost(e), 0);
  const next30 = +now + 30 * 24 * 3600 * 1000;
  const upcomingTravel = upcoming
    .filter((e) => +new Date(e.startDate) <= next30 && (e.type === "travel" || e.type === "camp" || e.type === "race"))
    .reduce((s, e) => s + eventTotalCost(e), 0);
  const remaining = opts.totalBudget - opts.spent;
  const budgetRiskPct = remaining > 0 ? Math.round((forecasted / remaining) * 100) : forecasted > 0 ? 999 : 0;
  return { totalBudget: opts.totalBudget, spent: opts.spent, remaining, forecasted, upcomingTravel, budgetRiskPct };
}

// Deterministic AI hints — explicit reasons coaches/admins can trust.
export function seasonHints(kpis: SeasonKpis, fmt: (n: number) => string): { kind: "warn" | "info"; text: string }[] {
  const out: { kind: "warn" | "info"; text: string }[] = [];
  if (kpis.budgetRiskPct >= 100 && kpis.remaining > 0) {
    out.push({ kind: "warn", text: `Forecasted upcoming spend (${fmt(kpis.forecasted)}) exceeds remaining budget (${fmt(kpis.remaining)}) by ${kpis.budgetRiskPct - 100}%. Consider cheaper Plan B locations or shorter camps.` });
  } else if (kpis.budgetRiskPct >= 85 && kpis.remaining > 0) {
    out.push({ kind: "warn", text: `Tight budget: planned upcoming spend uses ${kpis.budgetRiskPct}% of what's left.` });
  } else if (kpis.totalBudget > 0 && kpis.forecasted > 0) {
    out.push({ kind: "info", text: `On track — planned upcoming spend is ${kpis.budgetRiskPct}% of remaining budget.` });
  }
  if (kpis.upcomingTravel > 0) {
    out.push({ kind: "info", text: `Next 30 days are travel-heavy: ${fmt(kpis.upcomingTravel)} in camps / races / travel scheduled.` });
  }
  return out;
}

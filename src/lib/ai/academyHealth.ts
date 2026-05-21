// ─────────────────────────────────────────────────────────────────────────────
// ACADEMY AI — business health (revenue · occupancy · retention)
//
// Reads the academy's live operational figures and produces headline health
// metrics + prioritised, plain-language insights the owner sees the moment they
// open LEAF. Deterministic + explainable. Money is in the academy's currency.
// ─────────────────────────────────────────────────────────────────────────────

export type HealthInsight = { kind: "strength" | "watch" | "info"; title: string; detail: string };

export type AcademyHealth = {
  collectionRate: number; // % of billed money collected
  retentionRate: number; // % of athletes retained (vs churned)
  occupancyPct: number; // group fill
  mrr: number; // monthly recurring estimate
  revenueAtRisk: number; // overdue outstanding
  insights: HealthInsight[];
};

export function academyHealth(input: {
  collected: number;
  outstandingTotal: number;
  overdueTotal: number;
  mrr: number;
  unpaidAthletes: number;
  occupancyPct: number;
  statuses: string[];
  fmt: (n: number) => string; // currency formatter
}): AcademyHealth {
  const { collected, outstandingTotal, overdueTotal, mrr, unpaidAthletes, occupancyPct, statuses, fmt } = input;

  const billed = collected + outstandingTotal;
  const collectionRate = billed > 0 ? Math.round((collected / billed) * 100) : 100;

  const retained = statuses.filter((s) => s === "active" || s === "injured" || s === "paused").length;
  const churned = statuses.filter((s) => s === "inactive").length;
  const retentionRate = retained + churned > 0 ? Math.round((retained / (retained + churned)) * 100) : 100;

  const insights: HealthInsight[] = [];

  // Revenue
  if (overdueTotal > 0) {
    insights.push({ kind: "watch", title: "Revenue at risk", detail: `${fmt(overdueTotal)} overdue across ${unpaidAthletes} athlete${unpaidAthletes === 1 ? "" : "s"} — chase collections.` });
  }
  if (collectionRate >= 90) insights.push({ kind: "strength", title: "Healthy collections", detail: `${collectionRate}% of billed fees collected.` });
  else if (billed > 0 && collectionRate < 75) insights.push({ kind: "watch", title: "Collections lagging", detail: `Only ${collectionRate}% of billed fees collected (${fmt(outstandingTotal)} outstanding).` });

  // Occupancy
  if (occupancyPct >= 85) insights.push({ kind: "strength", title: "Near full capacity", detail: `Groups are ${occupancyPct}% full — strong utilisation.` });
  else if (occupancyPct <= 50) insights.push({ kind: "watch", title: "Spare capacity", detail: `Groups only ${occupancyPct}% full — room to recruit or consolidate.` });
  else insights.push({ kind: "info", title: "Occupancy", detail: `Groups ${occupancyPct}% full.` });

  // Retention
  if (churned > 0 && retentionRate < 85) insights.push({ kind: "watch", title: "Retention dip", detail: `${churned} athlete${churned === 1 ? "" : "s"} inactive — retention at ${retentionRate}%.` });
  else if (retentionRate >= 95 && retained >= 5) insights.push({ kind: "strength", title: "Strong retention", detail: `${retentionRate}% of athletes retained.` });

  const order = { strength: 0, watch: 1, info: 2 } as const;
  insights.sort((a, b) => order[a.kind] - order[b.kind]);

  return { collectionRate, retentionRate, occupancyPct, mrr, revenueAtRisk: overdueTotal, insights };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACADEMY AI — coach briefing
//
// A short, plain-language read of the coach's squad for the start of the week:
// who's moving, who needs attention, and the operational items to clear. Built
// from data the coach dashboard already loads. Deterministic + explainable.
// ─────────────────────────────────────────────────────────────────────────────

export type CoachBriefing = { headline: string; lines: { kind: "strength" | "watch" | "info"; text: string }[] };

function names(list: string[], max = 3): string {
  if (list.length <= max) return list.join(", ");
  return `${list.slice(0, max).join(", ")} +${list.length - max}`;
}

export function deriveCoachSummary(input: {
  athleteCount: number;
  improvingNames: string[];
  decliningNames: string[];
  overdue: number;
  docIssues: number;
}): CoachBriefing {
  const { athleteCount, improvingNames, decliningNames, overdue, docIssues } = input;
  const needs = decliningNames.length + overdue + docIssues;

  const headline =
    athleteCount === 0
      ? "No athletes assigned yet."
      : `${athleteCount} athlete${athleteCount === 1 ? "" : "s"} — ${improvingNames.length} improving, ${needs} item${needs === 1 ? "" : "s"} to look at.`;

  const lines: CoachBriefing["lines"] = [];
  if (improvingNames.length) lines.push({ kind: "strength", text: `On the up: ${names(improvingNames)}.` });
  if (decliningNames.length) lines.push({ kind: "watch", text: `Trending down: ${names(decliningNames)} — worth a check-in.` });
  if (overdue) lines.push({ kind: "watch", text: `${overdue} overdue payment${overdue === 1 ? "" : "s"} to chase.` });
  if (docIssues) lines.push({ kind: "watch", text: `${docIssues} athlete${docIssues === 1 ? "" : "s"} with missing/expired documents.` });
  if (lines.length === 0 && athleteCount > 0) lines.push({ kind: "info", text: "Squad is on track — nothing flagged." });

  return { headline, lines };
}

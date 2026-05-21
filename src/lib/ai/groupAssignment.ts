import { sportConfig } from "@/lib/sport";

// ─────────────────────────────────────────────────────────────────────────────
// SMART GROUP ASSIGNMENT — Academy AI intelligence layer
//
// A deterministic, fully explainable recommender. Given an applicant and the
// academy's groups (with their configured rules + current load), it scores each
// group and returns a ranked list with the reasons behind every score. It SUGGESTS
// — the coach/admin always assigns manually. Not a chatbot; a transparent engine
// that can later be augmented with learned weights.
// ─────────────────────────────────────────────────────────────────────────────

export type AthleteInput = {
  sport: string;
  points: number | null; // ranking points in the sport's native scale
  age: number | null;
  discipline: string | null;
  trendDeltaPoints?: number | null; // change over tracked period (sign per sport)
};

export type GroupInput = {
  id: string;
  name: string;
  sport: string;
  capacity: number;
  enrolledCount: number;
  pointsMin: number | null;
  pointsMax: number | null;
  ageMin: number | null;
  ageMax: number | null;
  discipline: string | null;
  level: string | null;
  coachName?: string | null;
};

export type Reason = { kind: "good" | "warn" | "info"; text: string };

export type GroupSuggestion = {
  groupId: string;
  groupName: string;
  fitScore: number; // 0–100
  reasons: Reason[];
  capacity: { used: number; total: number; full: boolean };
  eligible: boolean; // false = hard mismatch (wrong sport / full / discipline clash)
  recommended: boolean; // top eligible suggestion above the confidence threshold
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function scoreGroup(athlete: AthleteInput, g: GroupInput): Omit<GroupSuggestion, "recommended"> {
  const cfg = sportConfig(athlete.sport);
  const reasons: Reason[] = [];
  let score = 50;
  let eligible = true;

  // Sport must match — otherwise the group is simply not applicable.
  if (g.sport !== athlete.sport) {
    return {
      groupId: g.id, groupName: g.name, fitScore: 0,
      reasons: [{ kind: "warn", text: `Different sport (${g.sport})` }],
      capacity: { used: g.enrolledCount, total: g.capacity, full: g.enrolledCount >= g.capacity },
      eligible: false,
    };
  }

  // Points band — the primary signal.
  if (athlete.points != null && (g.pointsMin != null || g.pointsMax != null)) {
    const lo = g.pointsMin ?? -Infinity;
    const hi = g.pointsMax ?? Infinity;
    const band = `${g.pointsMin ?? "–"}–${g.pointsMax ?? "–"}`;
    if (athlete.points >= lo && athlete.points <= hi) {
      score += 35;
      reasons.push({ kind: "good", text: `${cfg.pointsLabel} ${athlete.points} fits the ${band} band` });
    } else {
      // distance to the nearest edge, relative to band width
      const edge = athlete.points < lo ? lo : hi;
      const width = Math.max(1, (Number.isFinite(hi) ? hi : lo + 20) - (Number.isFinite(lo) ? lo : hi - 20));
      const dist = Math.abs(athlete.points - edge);
      if (dist <= width * 0.25) {
        score += 8;
        reasons.push({ kind: "info", text: `${cfg.pointsLabel} ${athlete.points} just outside the ${band} band` });
      } else {
        score -= 18;
        reasons.push({ kind: "warn", text: `${cfg.pointsLabel} ${athlete.points} outside the ${band} band` });
      }
    }
  } else if (g.pointsMin == null && g.pointsMax == null) {
    reasons.push({ kind: "info", text: "No points band configured" });
  }

  // Age window.
  if (athlete.age != null && (g.ageMin != null || g.ageMax != null)) {
    const okLo = g.ageMin == null || athlete.age >= g.ageMin;
    const okHi = g.ageMax == null || athlete.age <= g.ageMax;
    const win = `${g.ageMin ?? "–"}–${g.ageMax ?? "–"}`;
    if (okLo && okHi) {
      score += 12;
      reasons.push({ kind: "good", text: `Age ${athlete.age} within ${win}` });
    } else {
      score -= 10;
      reasons.push({ kind: "warn", text: `Age ${athlete.age} outside ${win}` });
    }
  }

  // Discipline filter.
  if (g.discipline) {
    if (athlete.discipline === g.discipline) {
      score += 10;
      reasons.push({ kind: "good", text: `Discipline match (${g.discipline.replace("_", " ")})` });
    } else {
      score -= 15;
      eligible = false;
      reasons.push({ kind: "warn", text: `Group is ${g.discipline.replace("_", " ")} only` });
    }
  }

  // Progression trend — a soft nudge (sport-aware: "better" direction differs).
  if (athlete.trendDeltaPoints != null && athlete.trendDeltaPoints !== 0) {
    const improving = cfg.pointsLowerIsBetter ? athlete.trendDeltaPoints < 0 : athlete.trendDeltaPoints > 0;
    if (improving) {
      score += 5;
      reasons.push({ kind: "info", text: "Improving trend — could fast-track" });
    }
  }

  // Capacity / group balance.
  const full = g.enrolledCount >= g.capacity;
  const load = g.capacity > 0 ? g.enrolledCount / g.capacity : 1;
  if (full) {
    score -= 40;
    eligible = false;
    reasons.push({ kind: "warn", text: `Group full (${g.enrolledCount}/${g.capacity})` });
  } else if (load >= 0.85) {
    score -= 8;
    reasons.push({ kind: "info", text: `Nearly full (${g.enrolledCount}/${g.capacity})` });
  } else {
    score += 4;
    reasons.push({ kind: "good", text: `Space available (${g.enrolledCount}/${g.capacity})` });
  }

  return {
    groupId: g.id,
    groupName: g.name,
    fitScore: clamp(Math.round(score)),
    reasons,
    capacity: { used: g.enrolledCount, total: g.capacity, full },
    eligible,
  };
}

// Returns groups ranked by fit. The single best eligible group above the
// confidence threshold is flagged `recommended`.
export function suggestGroups(athlete: AthleteInput, groups: GroupInput[], threshold = 60): GroupSuggestion[] {
  const scored = groups
    .map((g) => scoreGroup(athlete, g))
    .sort((a, b) => b.fitScore - a.fitScore);

  let recommendedSet = false;
  return scored.map((s) => {
    const recommended = !recommendedSet && s.eligible && s.fitScore >= threshold;
    if (recommended) recommendedSet = true;
    return { ...s, recommended };
  });
}

import { prisma } from "@/lib/db";
import { readinessBand, type ReadinessBand } from "@/lib/wellnessCore";

// Server read layer for the wellness/AMS module.

function todayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export type CheckinRow = {
  date: string; readiness: number; sleepQuality: number; soreness: number;
  energy: number; mood: number; stress: number; sleepHours: number | null; note: string | null;
};

export type AthleteWellness = {
  today: CheckinRow | null;
  history: CheckinRow[];        // ascending, last ~14 days
  streak: number;               // consecutive days checked in ending today
};

function toRow(r: {
  date: Date; readiness: number; sleepQuality: number; soreness: number;
  energy: number; mood: number; stress: number; sleepHours: number | null; note: string | null;
}): CheckinRow {
  return { date: r.date.toISOString(), readiness: r.readiness, sleepQuality: r.sleepQuality, soreness: r.soreness,
    energy: r.energy, mood: r.mood, stress: r.stress, sleepHours: r.sleepHours, note: r.note };
}

export async function getAthleteWellness(athleteId: string): Promise<AthleteWellness> {
  const since = new Date(todayUTC().getTime() - 13 * 86_400_000);
  const rows = await prisma.wellnessCheckin.findMany({
    where: { athleteId, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { date: true, readiness: true, sleepQuality: true, soreness: true, energy: true, mood: true, stress: true, sleepHours: true, note: true },
  });
  const today = todayUTC().toISOString();
  const history = rows.map(toRow);
  const todayRow = history.find((h) => h.date === today) ?? null;

  // Streak: walk back day-by-day from today while a check-in exists.
  const days = new Set(history.map((h) => h.date));
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(todayUTC().getTime() - i * 86_400_000).toISOString();
    if (days.has(d)) streak++; else break;
  }

  return { today: todayRow, history, streak };
}

export type SquadMember = {
  athleteId: string; name: string;
  checkedInToday: boolean;
  readiness: number | null;      // latest
  band: ReadinessBand;
  lastDate: string | null;
  soreness: number | null;
  sleepHours: number | null;
  trend: number[];               // last 7 readiness values, ascending
};

export type WellnessAlert = { athleteId: string; name: string; kind: "low" | "sore" | "missing"; msg: string };

export type SquadReadiness = {
  members: SquadMember[];
  alerts: WellnessAlert[];
  checkedInToday: number;
  avgReadiness: number | null;
  total: number;
};

// Roster = athletes tied to this academy through an enrollment (ski) OR a
// tennis season plan (tennis). Same union the dossier uses.
async function rosterFor(academyId: string): Promise<{ id: string; name: string }[]> {
  const [enr, plans] = await Promise.all([
    prisma.enrollment.findMany({ where: { academyId }, select: { athlete: { select: { id: true, firstName: true, lastName: true } } } }),
    prisma.tennisSeasonPlan.findMany({ where: { academyId }, select: { athlete: { select: { id: true, firstName: true, lastName: true } } } }),
  ]);
  const byId = new Map<string, string>();
  for (const e of enr) byId.set(e.athlete.id, `${e.athlete.firstName} ${e.athlete.lastName}`.trim());
  for (const p of plans) if (!byId.has(p.athlete.id)) byId.set(p.athlete.id, `${p.athlete.firstName} ${p.athlete.lastName}`.trim());
  return [...byId.entries()].map(([id, name]) => ({ id, name }));
}

export async function getSquadReadiness(academyId: string): Promise<SquadReadiness> {
  const roster = await rosterFor(academyId);
  if (roster.length === 0) return { members: [], alerts: [], checkedInToday: 0, avgReadiness: null, total: 0 };

  const ids = roster.map((r) => r.id);
  const since = new Date(todayUTC().getTime() - 6 * 86_400_000);
  const checkins = await prisma.wellnessCheckin.findMany({
    where: { athleteId: { in: ids }, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { athleteId: true, date: true, readiness: true, soreness: true, sleepHours: true },
  });

  const byAthlete = new Map<string, typeof checkins>();
  for (const c of checkins) (byAthlete.get(c.athleteId) ?? byAthlete.set(c.athleteId, []).get(c.athleteId)!).push(c);

  const today = todayUTC().toISOString();
  const members: SquadMember[] = [];
  const alerts: WellnessAlert[] = [];

  for (const r of roster) {
    const list = byAthlete.get(r.id) ?? [];
    const latest = list[list.length - 1] ?? null;
    const checkedInToday = !!latest && latest.date.toISOString() === today;
    const readiness = latest?.readiness ?? null;
    const band = readinessBand(readiness);
    members.push({
      athleteId: r.id, name: r.name, checkedInToday, readiness, band,
      lastDate: latest?.date.toISOString() ?? null,
      soreness: latest?.soreness ?? null, sleepHours: latest?.sleepHours ?? null,
      trend: list.map((c) => c.readiness),
    });
    if (checkedInToday && readiness != null && readiness < 40) alerts.push({ athleteId: r.id, name: r.name, kind: "low", msg: `Prontezza bassa (${readiness})` });
    if (checkedInToday && (latest?.soreness ?? 0) >= 4) alerts.push({ athleteId: r.id, name: r.name, kind: "sore", msg: `Dolori muscolari alti` });
    if (!checkedInToday) alerts.push({ athleteId: r.id, name: r.name, kind: "missing", msg: `Check-in di oggi mancante` });
  }

  // Ready first? No — surface trouble: low band first, then missing, then good.
  const order: Record<ReadinessBand, number> = { low: 0, watch: 1, good: 2 };
  members.sort((a, b) => (a.checkedInToday === b.checkedInToday ? order[a.band] - order[b.band] : a.checkedInToday ? -1 : 1));

  const done = members.filter((m) => m.checkedInToday);
  const avgReadiness = done.length ? Math.round(done.reduce((s, m) => s + (m.readiness ?? 0), 0) / done.length) : null;

  // Alerts most-actionable first: low, sore, then missing.
  const aOrder: Record<WellnessAlert["kind"], number> = { low: 0, sore: 1, missing: 2 };
  alerts.sort((a, b) => aOrder[a.kind] - aOrder[b.kind]);

  return { members, alerts, checkedInToday: done.length, avgReadiness, total: roster.length };
}

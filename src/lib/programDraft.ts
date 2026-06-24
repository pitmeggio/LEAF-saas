import { prisma } from "@/lib/db";
import { getCalendarEvents } from "@/lib/calendar";
import { getProgramsForOps } from "@/lib/programs";
import type { LineupRow } from "@/lib/trainingProgram";

// "LEAF prepares tomorrow's session for the coach."
// The whole point: the coach opens the form NOT blank but with a sensible draft
// already filled — date = tomorrow, their main group + roster loaded, a session
// shaped around the next race on the calendar. Rule-based (no external AI), so
// it always works, instantly. The coach reviews, tweaks the one human thing
// (each athlete's goal) and publishes.

export type ProgramDraft = {
  kind: "training";
  title: string;
  place: string;
  discipline: string;
  date: string; // yyyy-mm-dd
  groupId: string;
  fields: Record<string, string>;
  lineup: LineupRow[];
  // Why-line shown on the button so the coach trusts the draft.
  rationale: string;
};

const ACTIVE = ["active", "accepted", "injured", "paused"] as const;

// Keys are normalized (lowercase, letters only) so "Giant Slalom",
// "giant_slalom", "GS" all resolve to "GS".
const DISC_CODE: Record<string, string> = {
  giantslalom: "GS", gs: "GS", slalom: "SL", sl: "SL",
  superg: "SG", sg: "SG", downhill: "DH", dh: "DH",
};
function discCode(d?: string | null): string | null {
  if (!d) return null;
  const norm = d.toLowerCase().replace(/[^a-z]/g, "");
  return DISC_CODE[norm] ?? d.replace(/[_\s]+/g, " ").trim().toUpperCase().slice(0, 3);
}

// Discipline-specific technical focus, rotated day-to-day so two consecutive
// drafts don't read identically.
const FOCUS: Record<string, string[]> = {
  GS: ["Linea pulita e anticipo, pressione sullo sci esterno", "Inizio curva rotondo: niente derapata in ingresso", "Posizione centrale e gestione del ripido"],
  SL: ["Ritmo e tempi, mani avanti e attive", "Cambio spigolo rapido, gambe che lavorano sotto il corpo", "Linea stretta al palo, sguardo avanti"],
  SG: ["Glide tra le porte e linee morbide", "Lettura del terreno e gestione dei salti", "Posizione aerodinamica e fiducia in velocità"],
  DH: ["Glide e aerodinamica, minima resistenza", "Memorizzazione tracciato e riferimenti", "Calma e fiducia ad alta velocità"],
};
const FOCUS_DEFAULT = ["Fondamentali tecnici e ritmo", "Qualità del movimento prima della velocità", "Costanza e ripetizione pulita"];

function tomorrowISO(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return t.toISOString().slice(0, 10);
}
function daysUntil(d: Date): number {
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
}

// Build the draft for the coach's main group (the one with the most athletes).
// Returns null only if the coach has no group at all.
export async function suggestProgramDraft(academyId: string, coachId: string): Promise<ProgramDraft | null> {
  const groups = await prisma.group.findMany({
    where: { academyId, coachId, active: true },
    select: { id: true, name: true, discipline: true },
  });
  if (groups.length === 0) return null;
  const groupIds = groups.map((g) => g.id);

  const enr = await prisma.enrollment.findMany({
    where: { academyId, groupId: { in: groupIds }, status: { in: [...ACTIVE] } },
    select: { groupId: true, athlete: { select: { id: true, firstName: true, lastName: true, discipline: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Pick the group with the most athletes (fallback: first group).
  const byGroup = new Map<string, typeof enr>();
  for (const e of enr) {
    if (!e.groupId) continue;
    (byGroup.get(e.groupId) ?? byGroup.set(e.groupId, []).get(e.groupId)!).push(e);
  }
  let group = groups[0];
  let best = -1;
  for (const g of groups) {
    const n = byGroup.get(g.id)?.length ?? 0;
    if (n > best) { best = n; group = g; }
  }
  const roster = byGroup.get(group.id) ?? [];

  // Discipline: group setting → most common among the roster → GS.
  const fromRoster = mode(roster.map((e) => discCode(e.athlete.discipline)).filter(Boolean) as string[]);
  const disc = discCode(group.discipline) ?? fromRoster ?? "GS";

  // Next race on the calendar (to shape the session around it).
  let nextRace: { title: string; date: Date; place: string | null; disc: string | null } | null = null;
  try {
    const events = await getCalendarEvents({ kind: "coach", academyId, coachId }, { upcomingOnly: true });
    const r = events.find((e) => (e.type ?? "").toLowerCase() === "race");
    if (r) nextRace = { title: r.title, date: new Date(r.startDate), place: r.location ?? null, disc: discCode(r.discipline) };
  } catch { /* calendar optional — draft still works without it */ }

  // Vary the focus by how many programmes already exist (so it rotates).
  const recent = await getProgramsForOps(coachId).catch(() => []);
  const rot = recent.length;
  const focusList = FOCUS[disc] ?? FOCUS_DEFAULT;
  const focus = focusList[rot % focusList.length];
  const lastPlace = (recent[0]?.place as string | undefined) ?? "";

  const raceSoon = nextRace && daysUntil(nextRace.date) >= 0 && daysUntil(nextRace.date) <= 14;
  const sessionDisc = raceSoon && nextRace!.disc ? nextRace!.disc : disc;

  const lineup: LineupRow[] = roster.map((e, i) => ({
    bib: String(i + 1),
    athleteId: e.athlete.id,
    name: `${e.athlete.firstName} ${e.athlete.lastName}`,
    goals: "",
  }));

  const fields: Record<string, string> = {
    startTime: "09:00",
    sessions: "2",
    runs: raceSoon ? "6–8 + simulazione gara" : "8–10",
    besWU: "Free ski + 2 drill (15')",
    focus,
    video: "Sì",
    slope: lastPlace,
  };
  if (raceSoon) fields.misc = `Prep gara: ${nextRace!.title} (${shortDate(nextRace!.date)})`;

  const title = raceSoon
    ? `Prep ${sessionDisc} · ${nextRace!.title}`
    : `${sessionDisc} · sessione tecnica`;

  const rationale = raceSoon
    ? `${group.name} · verso ${nextRace!.title} fra ${daysUntil(nextRace!.date)}gg`
    : `${group.name} · ${sessionDisc} · ${roster.length} atleti`;

  return {
    kind: "training",
    title,
    place: nextRace && raceSoon ? (nextRace.place ?? lastPlace) : lastPlace,
    discipline: sessionDisc,
    date: tomorrowISO(),
    groupId: group.id,
    fields,
    lineup,
    rationale,
  };
}

function mode(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const c = new Map<string, number>();
  let bestK = arr[0], bestN = 0;
  for (const x of arr) { const n = (c.get(x) ?? 0) + 1; c.set(x, n); if (n > bestN) { bestN = n; bestK = x; } }
  return bestK;
}
function shortDate(d: Date): string {
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

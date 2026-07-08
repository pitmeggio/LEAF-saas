"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { firstError } from "@/lib/validation";
import {
  tennisRankingProvider,
  getTennisRankingMode,
  type TennisRankingSource,
} from "@/lib/tennis/ranking";

type Result =
  | { ok: true; added?: number; mode?: string }
  | { ok: false; error: string };

const SOURCES = ["FIT", "ITF", "ATP", "WTA"] as const;

// Tenant ownership for a tennis athlete. They are linked to the academy through
// a TennisSeasonPlan (canvas/season view) or an Enrollment. Either is enough.
async function ownAthlete(athleteId: string, academyId: string) {
  return prisma.athlete.findFirst({
    where: {
      id: athleteId,
      OR: [
        { tennisSeasonPlans: { some: { academyId } } },
        { enrollments: { some: { academyId } } },
      ],
    },
    select: { id: true },
  });
}

const CODE_FIELD: Record<TennisRankingSource, "atpPlayerId" | "itfJuniorRef" | "fitTessera"> = {
  ATP: "atpPlayerId",
  WTA: "atpPlayerId",
  ITF: "itfJuniorRef",
  FIT: "fitTessera",
};

function rev(athleteId: string) {
  revalidatePath(`/dashboard/canvas/${athleteId}`);
  revalidatePath(`/dashboard/athletes/${athleteId}`);
}

// ── Import by athlete code ──────────────────────────────────────────────────
const importSchema = z.object({
  athleteId: z.string().min(1),
  source: z.enum(SOURCES),
  code: z.string().trim().min(1).max(60),
});

export async function importTennisRanking(input: z.input<typeof importSchema>): Promise<Result> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { athleteId, source, code } = parsed.data;

  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  if (!(await ownAthlete(athleteId, s.academyId))) return { ok: false, error: "Atleta non trovato in questa academy." };

  // Persist the code so a future sync can run without re-typing it — even when
  // there's no live feed yet, saving the code is the useful part.
  await prisma.athlete.update({ where: { id: athleteId }, data: { [CODE_FIELD[source]]: code } });

  const mode = getTennisRankingMode();
  // Without a real feed we DON'T fabricate a ranking on a real athlete. The
  // code is saved; the classifica is entered by hand below (or auto-syncs once
  // the official ITF/FIT connector is wired).
  if (mode !== "live") {
    return { ok: false, error: `Codice ${code} salvato. Il feed ufficiale ${source} non è ancora collegato — inserisci la classifica a mano qui sotto (si sincronizzerà da sola quando attiviamo il feed).` };
  }

  let snapshots;
  try {
    snapshots = await tennisRankingProvider().fetchByCode(source, code);
  } catch {
    return { ok: false, error: "Sorgente non raggiungibile al momento. Riprova tra poco." };
  }

  if (snapshots.length === 0) {
    return { ok: false, error: `Nessun risultato per il codice ${code} su ${source}. Verifica il codice o inserisci la classifica manualmente.` };
  }

  // Replace this source's imported snapshots, keep manual ones untouched.
  const origin = "import:live";
  await prisma.tennisRankingSnapshot.deleteMany({ where: { athleteId, source, origin: { startsWith: "import:" } } });

  let added = 0;
  for (const snap of snapshots) {
    await prisma.tennisRankingSnapshot.create({
      data: {
        athleteId, source,
        date: new Date(snap.date),
        rank: snap.rank ?? null,
        points: snap.points ?? null,
        classifica: snap.classifica ?? null,
        category: snap.category ?? null,
        origin,
      },
    });
    added++;
  }

  rev(athleteId);
  return { ok: true, added, mode };
}

// ── Manual entry — the real, usable-today path ──────────────────────────────
const manualSchema = z.object({
  athleteId: z.string().min(1),
  source: z.enum(SOURCES),
  date: z.string().min(1),
  rank: z.coerce.number().int().min(1).max(100000).nullish(),
  points: z.coerce.number().int().min(0).max(100000).nullish(),
  classifica: z.string().trim().max(10).nullish().transform((v) => v || null),
  category: z.string().trim().max(40).nullish().transform((v) => v || null),
});

export async function addTennisRankingManual(input: z.input<typeof manualSchema>): Promise<Result> {
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  if (!(await ownAthlete(d.athleteId, s.academyId))) return { ok: false, error: "Atleta non trovato in questa academy." };

  const isFit = d.source === "FIT";
  if (isFit && !d.classifica) return { ok: false, error: "Inserisci la classifica FIT (es. 2.6)." };
  if (!isFit && d.rank == null && d.points == null) return { ok: false, error: "Inserisci la posizione o i punti." };

  const date = new Date(d.date);
  if (isNaN(date.getTime())) return { ok: false, error: "Data non valida." };

  await prisma.tennisRankingSnapshot.create({
    data: {
      athleteId: d.athleteId, source: d.source, date,
      rank: d.rank ?? null, points: d.points ?? null,
      classifica: d.classifica, category: d.category, origin: "manual",
    },
  });

  rev(d.athleteId);
  return { ok: true, added: 1 };
}

// ── TennisTalker — search by NAME + import the real FIT classifica ───────────
// The public Italian source. Search returns candidates (name + current
// classifica + category); importing stamps a dated FIT snapshot and saves the
// federation tessera so the trajectory builds up over repeated syncs.
export type TTSearchResult =
  | { ok: true; players: { id: number; name: string; classifica: string | null; category: string | null }[] }
  | { ok: false; error: string };

export async function searchTennisTalkerPlayers(query: string): Promise<TTSearchResult> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  const q = (query ?? "").trim();
  if (q.length < 2) return { ok: true, players: [] };
  try {
    const { ttSearchPlayers, prettyName } = await import("@/lib/tennis/tennisTalker");
    const players = (await ttSearchPlayers(q)).map((p) => ({ ...p, name: prettyName(p.name) }));
    return { ok: true, players };
  } catch {
    return { ok: false, error: "TennisTalker non raggiungibile al momento. Riprova tra poco." };
  }
}

export async function importFromTennisTalker(athleteId: string, ttPlayerId: number): Promise<Result> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  if (!(await ownAthlete(athleteId, s.academyId))) return { ok: false, error: "Atleta non trovato in questa academy." };

  let player;
  try {
    const { ttGetPlayer } = await import("@/lib/tennis/tennisTalker");
    player = await ttGetPlayer(ttPlayerId);
  } catch {
    return { ok: false, error: "TennisTalker non raggiungibile al momento. Riprova tra poco." };
  }
  if (!player || !player.classifica) return { ok: false, error: "Classifica non disponibile per questo giocatore su TennisTalker." };

  // Persist the FIT tessera so a future sync can jump straight to the player.
  if (player.cardNumber) {
    await prisma.athlete.update({ where: { id: athleteId }, data: { fitTessera: player.cardNumber } }).catch(() => {});
  }

  // One snapshot per calendar day: replace today's import, keep older ones so
  // the trajectory accumulates over time.
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  await prisma.tennisRankingSnapshot.deleteMany({
    where: { athleteId, source: "FIT", origin: "import:tennistalker", date: { gte: dayStart, lt: dayEnd } },
  });
  await prisma.tennisRankingSnapshot.create({
    data: { athleteId, source: "FIT", date: now, classifica: player.classifica, category: player.category, origin: "import:tennistalker" },
  });

  rev(athleteId);
  return { ok: true, added: 1 };
}

export async function deleteTennisRankingSnapshot(id: string): Promise<{ ok: boolean }> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false };
  const row = await prisma.tennisRankingSnapshot.findUnique({ where: { id }, select: { athleteId: true } });
  if (!row || !(await ownAthlete(row.athleteId, s.academyId))) return { ok: false };
  await prisma.tennisRankingSnapshot.delete({ where: { id } });
  rev(row.athleteId);
  return { ok: true };
}

// Wipe all (or one source's) snapshots — used to clear demo data.
export async function clearTennisRankings(athleteId: string, source?: string): Promise<{ ok: boolean; count?: number }> {
  const s = await requireAdmin();
  if (!s.academyId) return { ok: false };
  if (!(await ownAthlete(athleteId, s.academyId))) return { ok: false };
  const r = await prisma.tennisRankingSnapshot.deleteMany({
    where: { athleteId, ...(source && (SOURCES as readonly string[]).includes(source) ? { source } : {}) },
  });
  rev(athleteId);
  return { ok: true, count: r.count };
}

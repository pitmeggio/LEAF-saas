"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { firstError } from "@/lib/validation";
import { tennisRankingProvider, getTennisRankingMode, type TennisRankingSource } from "@/lib/tennis/ranking";

type Result = { ok: true; created: number } | { ok: false; error: string };

const CODE_FIELD: Record<TennisRankingSource, "atpPlayerId" | "itfJuniorRef" | "fitTessera"> = {
  ATP: "atpPlayerId", WTA: "atpPlayerId", ITF: "itfJuniorRef", FIT: "fitTessera",
};

// Add tennis athletes to the roster. A tennis athlete is "in the academy" via a
// TennisSeasonPlan, so we create the Athlete + an (empty) plan for the academy's
// season — that makes them show up in Canvas, Dossier, Season View immediately.
// Accepts one athlete (firstName + optional details) OR a paste of many names
// (one per line) for a quick bulk import.
const schema = z.object({
  firstName: z.string().trim().max(60).nullish().transform((v) => v?.trim() || null),
  lastName: z.string().trim().max(60).nullish().transform((v) => v?.trim() || null),
  yob: z.coerce.number().int().min(1950).max(2025).nullish(),
  gender: z.enum(["M", "F"]).nullish(),
  dominantHand: z.enum(["right", "left"]).nullish(),
  bulk: z.string().trim().max(4000).nullish().transform((v) => v?.trim() || null),
  // Import-by-code (same principle as the FIS import, ITF/ATP/FIT-shaped).
  source: z.enum(["FIT", "ITF", "ATP", "WTA"]).nullish(),
  code: z.string().trim().max(60).nullish().transform((v) => v?.trim() || null),
});

export async function createTennisAthletes(input: z.input<typeof schema>): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;

  const s = await requireAdmin();
  if (!s.academyId) return { ok: false, error: "Nessuna academy in sessione." };
  const academy = await prisma.academy.findUnique({ where: { id: s.academyId }, select: { season: true, sport: true } });
  const season = academy?.season ?? "2026";
  const sport = academy?.sport ?? "tennis";

  // Build the work-list: either the bulk paste (one name per line) or a single
  // athlete from the structured fields.
  const names: { firstName: string; lastName: string | null }[] = [];
  if (d.bulk) {
    for (const line of d.bulk.split("\n").map((l) => l.trim()).filter(Boolean)) {
      names.push({ firstName: line, lastName: null });
    }
  } else if (d.firstName) {
    names.push({ firstName: d.firstName, lastName: d.lastName });
  }
  if (names.length === 0) return { ok: false, error: "Inserisci almeno un nome." };
  if (names.length > 60) return { ok: false, error: "Massimo 60 atleti per volta." };

  const dob = d.yob ? new Date(Date.UTC(d.yob, 5, 15)) : new Date(Date.UTC(2010, 5, 15));

  const single = names.length === 1;
  let created = 0;
  for (const n of names) {
    const athlete = await prisma.athlete.create({
      data: {
        firstName: n.firstName,
        lastName: n.lastName ?? "",
        dob,
        nationality: "ITA",
        gender: d.gender ?? null,
        sport,
        discipline: "singles",
        dominantHand: single ? d.dominantHand ?? null : null,
        ...(single && d.source && d.code ? { [CODE_FIELD[d.source]]: d.code } : {}),
      },
    });
    await prisma.tennisSeasonPlan.create({
      data: { academyId: s.academyId, athleteId: athlete.id, season, columns: [] },
    });

    // The federation code is saved on the athlete (above). We only pull the
    // ranking trajectory when a REAL feed is configured — never fabricate
    // numbers on a real athlete. With no live feed, the code is stored and the
    // classifica is entered by hand on the athlete page (or auto-syncs later).
    if (single && d.source && d.code && getTennisRankingMode() === "live") {
      try {
        const snaps = await tennisRankingProvider().fetchByCode(d.source, d.code);
        for (const snap of snaps) {
          await prisma.tennisRankingSnapshot.create({
            data: {
              athleteId: athlete.id, source: d.source, date: new Date(snap.date),
              rank: snap.rank ?? null, points: snap.points ?? null, classifica: snap.classifica ?? null,
              category: snap.category ?? null, origin: "import:live",
            },
          });
        }
      } catch { /* athlete is created regardless of ranking fetch */ }
    }
    created++;
  }

  revalidatePath("/dashboard/canvas");
  revalidatePath("/dashboard/dossier");
  revalidatePath("/dashboard/season");
  return { ok: true, created };
}

import { prisma } from "@/lib/db";
import type { FisProvider, FisAthleteData } from "./types";
import { simulatedFisProvider, colorForCode } from "./simulatedProvider";
import { liveFisProvider } from "./liveProvider";
import { fisAthleteDataSchema } from "@/lib/validation";

// Provider selection (env: FIS_PROVIDER = live | simulated | auto, default LIVE):
//  • live      — real FIS points-list data only; unknown codes return null
//                so the user sees a real "not found" error (safe for real
//                tenants — what you see is what FIS has)
//  • simulated — deterministic demo data only (curated codes + hash-seeded
//                fakes for everything else; for offline screenshots / demos)
//  • auto      — try live first, fall back to simulated. DANGER on real
//                tenants: a code missing from FIS returns realistic-looking
//                fake data with no UI indication. Only the public LEAF demo
//                site should run in this mode.
//
// We expose the resolved mode via `getFisProviderMode()` so the import UI
// can badge it (Live = green, Demo = yellow) — trust matters: a coach
// scanning the page should know immediately whether the data they're
// about to import is real or fabricated.
export type FisProviderMode = "live" | "simulated" | "auto";

export function getFisProviderMode(): FisProviderMode {
  const raw = (process.env.FIS_PROVIDER ?? "live").toLowerCase();
  if (raw === "simulated") return "simulated";
  if (raw === "auto") return "auto";
  return "live";
}

const mode = getFisProviderMode();
const provider: FisProvider =
  mode === "simulated"
    ? simulatedFisProvider
    : mode === "live"
      ? liveFisProvider
      : {
          sourceName: "FIS",
          async fetchByCode(code: string): Promise<FisAthleteData | null> {
            return (await liveFisProvider.fetchByCode(code)) ?? (await simulatedFisProvider.fetchByCode(code));
          },
        };

export type ImportResult = {
  athleteId: string;
  created: boolean;
  fullName: string;
  source: string;
};

export async function importAthleteByFisCode(rawCode: string): Promise<ImportResult | null> {
  const raw = await provider.fetchByCode(rawCode);
  if (!raw) return null;

  // Validate the provider output before persisting — hardens the ingestion boundary
  // so a malformed external record can never corrupt athlete data.
  const result = fisAthleteDataSchema.safeParse(raw);
  if (!result.success) return null;
  const data = result.data;

  const dob = new Date(Date.UTC(data.birthYear, 5, 15));
  const existing = await prisma.athlete.findUnique({ where: { fisCode: data.fisCode } });

  const core = {
    firstName: data.firstName,
    lastName: data.lastName,
    dob,
    nationality: data.nation,
    gender: data.gender,
    discipline: data.discipline,
    fisPoints: data.currentPoints,
    worldRank: data.worldRank,
    verified: true,
  };

  const athlete = existing
    ? await prisma.athlete.update({ where: { id: existing.id }, data: core })
    : await prisma.athlete.create({
        data: {
          ...core,
          fisCode: data.fisCode,
          photoColor: colorForCode(data.fisCode),
          location: data.nation,
          bio: `Imported from ${provider.sourceName}. ${data.discipline.replace("_", " ")} athlete.`,
        },
      });

  // Replace performance history with the freshly fetched series.
  await prisma.rankingPoint.deleteMany({ where: { athleteId: athlete.id } });
  await prisma.result.deleteMany({ where: { athleteId: athlete.id } });

  await prisma.rankingPoint.createMany({
    data: data.history.map((h) => ({
      athleteId: athlete.id,
      date: new Date(h.date),
      fisPoints: h.fisPoints,
      worldRank: h.worldRank,
    })),
  });
  await prisma.result.createMany({
    data: data.results.map((r) => ({
      athleteId: athlete.id,
      date: new Date(r.date),
      eventName: r.eventName,
      location: r.location,
      discipline: r.discipline,
      rank: r.rank,
      fisPoints: r.fisPoints,
    })),
  });

  return {
    athleteId: athlete.id,
    created: !existing,
    fullName: `${data.firstName} ${data.lastName}`,
    source: provider.sourceName,
  };
}

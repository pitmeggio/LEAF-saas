// Universal Athlete Performance Layer — accessor.
//
// Athlete is the universal record. Sport-specific dimensions live in 1:1
// extension tables (SkiProfile, TennisProfile) — the future-proof shape that
// keeps a third sport from polluting the Athlete model with another wave of
// nullable columns.
//
// For the MVP both shapes are read here: the new extension table wins when
// populated, the legacy columns on Athlete are the fallback. Call sites can
// migrate to this accessor one at a time without breaking — when every
// reader uses it, the legacy columns can be dropped in a single commit.

export type SkiProfileView = {
  fisCode: string | null;
  fisPoints: number | null;
  worldRank: number | null;
  specialty: string | null;   // SL / GS / SG / DH / …
};

export type TennisProfileView = {
  dominantHand: string | null;
  playingStyle: string | null;
  technicalLevel: number | null;
  tacticalLevel: number | null;
  physicalLevel: number | null;
  mentalLevel: number | null;
  developmentGoals: string | null;
};

// The legacy column shape — every field optional so an Athlete fetched with
// or without the new relations still satisfies the input. The relations are
// equally optional so the accessor works in both directions of the migration.
type AthleteLike = {
  // legacy ski columns
  fisCode?: string | null;
  fisPoints?: number | null;
  worldRank?: number | null;
  discipline?: string | null;
  // legacy tennis columns
  dominantHand?: string | null;
  playingStyle?: string | null;
  technicalLevel?: number | null;
  tacticalLevel?: number | null;
  physicalLevel?: number | null;
  mentalLevel?: number | null;
  developmentGoals?: string | null;
  // new extension tables (when included by Prisma)
  skiProfile?: SkiProfileView | null;
  tennisProfileExt?: TennisProfileView | null;
};

// "New wins, legacy is the fallback" — preserves backward compatibility
// across the whole codebase while the migration is in flight.
function pick<T>(neu: T | null | undefined, legacy: T | null | undefined): T | null {
  return neu !== null && neu !== undefined ? neu : legacy ?? null;
}

export function getSkiProfile(athlete: AthleteLike): SkiProfileView {
  const ext = athlete.skiProfile ?? null;
  return {
    fisCode: pick(ext?.fisCode, athlete.fisCode),
    fisPoints: pick(ext?.fisPoints, athlete.fisPoints),
    worldRank: pick(ext?.worldRank, athlete.worldRank),
    specialty: pick(ext?.specialty, athlete.discipline),
  };
}

export function getTennisProfile(athlete: AthleteLike): TennisProfileView {
  const ext = athlete.tennisProfileExt ?? null;
  return {
    dominantHand: pick(ext?.dominantHand, athlete.dominantHand),
    playingStyle: pick(ext?.playingStyle, athlete.playingStyle),
    technicalLevel: pick(ext?.technicalLevel, athlete.technicalLevel),
    tacticalLevel: pick(ext?.tacticalLevel, athlete.tacticalLevel),
    physicalLevel: pick(ext?.physicalLevel, athlete.physicalLevel),
    mentalLevel: pick(ext?.mentalLevel, athlete.mentalLevel),
    developmentGoals: pick(ext?.developmentGoals, athlete.developmentGoals),
  };
}

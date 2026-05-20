// Normalized shape returned by any FIS data source.
// The real FIS connector (scraper / official feed) must produce this exact shape,
// so nothing downstream changes when the simulated provider is swapped out.

export type FisPointSnapshot = {
  date: string; // ISO
  fisPoints: number; // lower = better
  worldRank: number;
};

export type FisResult = {
  date: string; // ISO
  eventName: string;
  location: string;
  discipline: string;
  rank: number;
  fisPoints: number;
};

export type FisAthleteData = {
  fisCode: string;
  firstName: string;
  lastName: string;
  nation: string; // ISO2
  gender: "M" | "F";
  birthYear: number;
  discipline: string; // slalom | giant_slalom | super_g | downhill
  currentPoints: number;
  worldRank: number;
  history: FisPointSnapshot[]; // ascending by date, ~13 monthly snapshots
  results: FisResult[];
};

export interface FisProvider {
  /** Returns the athlete record for a FIS code, or null if not found. */
  fetchByCode(fisCode: string): Promise<FisAthleteData | null>;
  readonly sourceName: string;
}

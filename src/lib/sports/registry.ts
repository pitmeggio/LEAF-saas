// Sport Module Registry — single lookup that every consumer goes through.
// Centralising it here means a new sport is one entry, not a grep-and-replace.

import { skiModule } from "@/lib/sports/ski";
import { tennisModule } from "@/lib/sports/tennis";
import type { SportKey, SportModule } from "@/lib/sports/types";

// Order matters: first entry is the platform default.
const MODULES: SportModule[] = [skiModule, tennisModule];

const BY_KEY: Map<string, SportModule> = new Map(MODULES.map((m) => [m.key, m]));

// Pick a module by key. Falls back to the default (ski) so the UI never
// crashes on an unknown / null sport — useful during transitions when an
// academy hasn't picked a sport yet.
export function getSportModule(key: string | null | undefined): SportModule {
  if (!key) return MODULES[0];
  return BY_KEY.get(key) ?? MODULES[0];
}

// All registered modules (use in admin dropdowns).
export function listSportModules(): SportModule[] {
  return MODULES;
}

// Convenience for places that have an Academy already in hand. The point of
// this helper is that every caller does the same fallback, so we don't end
// up with subtly different "what's the active sport?" logic in 12 places.
export function getSportModuleForAcademy(academy: { sport?: string | null } | null | undefined): SportModule {
  return getSportModule(academy?.sport);
}

export type { SportModule, SportKey } from "@/lib/sports/types";

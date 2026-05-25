import { cookies } from "next/headers";
import { currentSeason, availableSeasons, type Season } from "@/lib/season";

const COOKIE = "leaf_season";

// The user's active season — stored in a long-lived cookie so it persists
// across navigations and reloads. Defaults to the current ski season.
export async function getActiveSeason(): Promise<Season> {
  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  if (raw && /^\d{4}\/\d{2}$/.test(raw)) return raw;
  return currentSeason();
}

// Convenience for layouts: active season + the selector options + flag if
// the active season differs from the current real-world season.
export async function getSeasonContext() {
  const active = await getActiveSeason();
  const seasons = availableSeasons(active);
  const real = currentSeason();
  return { active, seasons, isCurrent: active === real };
}

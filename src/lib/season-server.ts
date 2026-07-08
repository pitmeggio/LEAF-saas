import { cookies } from "next/headers";
import { currentSeason, availableSeasons, type Season } from "@/lib/season";
import { getActiveAcademy } from "@/lib/auth";

const COOKIE = "leaf_season";

// Tennis / padel academies keep the books on the calendar year ("2026");
// everyone else (ski) uses the alpine "YYYY/YY" season. This decides both the
// valid cookie format and the fallback default.
function isCalendarSport(sport?: string | null): boolean {
  return sport === "tennis" || sport === "padel";
}

// The user's active season — sport-aware. A cookie is only honoured if it
// matches the academy's season *format* (so a stale "2026/27" from a ski visit
// doesn't leak into a tennis academy and hide all its season-scoped data).
// Falls back to the academy's stored season, then to the computed current one.
export async function getActiveSeason(): Promise<Season> {
  const academy = await getActiveAcademy();
  const calendar = isCalendarSport(academy?.sport);
  const fmt = calendar ? /^\d{4}$/ : /^\d{4}\/\d{2}$/;

  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  if (raw && fmt.test(raw)) return raw;

  return academy?.season ?? currentSeason(calendar);
}

// Convenience for layouts: active season + the selector options + flag if
// the active season differs from the current real-world season.
export async function getSeasonContext() {
  const academy = await getActiveAcademy();
  const calendar = isCalendarSport(academy?.sport);
  const active = await getActiveSeason();
  const seasons = availableSeasons(active);
  const real = currentSeason(calendar);
  return { active, seasons, isCurrent: active === real };
}

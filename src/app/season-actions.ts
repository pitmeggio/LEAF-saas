"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// Persist the active season globally — long-lived cookie so it survives
// navigation and reload. Accepts ski "YYYY/YY" and tennis calendar "YYYY".
export async function setActiveSeason(season: string): Promise<{ ok: boolean }> {
  if (!/^\d{4}(\/\d{2})?$/.test(season)) return { ok: false };
  const c = await cookies();
  c.set("leaf_season", season, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  // Bust caches on the surfaces that consume the season filter.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/budgets");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}

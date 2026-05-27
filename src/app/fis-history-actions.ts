"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { liveFisProvider } from "@/lib/fis/liveProvider";
import { getFisProviderMode } from "@/lib/fis/import";

type Result =
  | { ok: true; snapshotsAdded: number; listsRead: number; lastPublishedAt: string | null }
  | { ok: false; error: string };

// Sync an athlete's per-discipline FIS points history. Walks the most recent
// N FIS points lists, extracts every discipline the athlete appears in, and
// upserts FisListSnapshot rows. Idempotent — the (athleteId, listid,
// discipline) unique key dedups across runs.
//
// Admin-only and tenant-scoped: an admin from academy A cannot sync an
// athlete that lives under academy B (the athlete must be enrolled in a
// group inside the caller's academy).
// Default 22 lists = a full alpine FIS season (≈Sep → May). Cold sync
// pulls all 22 CSVs in parallel once and caches in-process for 6h, so
// repeat syncs across athletes are essentially free after the first.
export async function syncAthleteFisHistory(athleteId: string, lookbackLists = 22): Promise<Result> {
  const session = await requireAdmin();
  if (!session.academyId) return { ok: false, error: "No academy in session." };

  // Tenant ownership: athlete must be enrolled in this academy (or have at
  // least one enrollment / application under it). The Athlete table itself
  // is shared, so we go through Enrollment.
  const athlete = await prisma.athlete.findFirst({
    where: {
      id: athleteId,
      enrollments: { some: { academyId: session.academyId } },
    },
    select: { id: true, fisCode: true, firstName: true, lastName: true },
  });
  if (!athlete) return { ok: false, error: "Athlete not found in this academy." };
  if (!athlete.fisCode) return { ok: false, error: "Athlete has no FIS code." };

  // Only the live provider hits the real FIS export. In simulated mode we
  // refuse instead of fabricating multi-list history — that would be the
  // exact "demo landmine" the FIS provider badge warns about.
  if (getFisProviderMode() !== "live") {
    return { ok: false, error: "Sync requires FIS_PROVIDER=live. Current mode does not fetch real FIS data." };
  }

  let snapshots: Awaited<ReturnType<typeof liveFisProvider.fetchHistoryByCode>>;
  try {
    snapshots = await liveFisProvider.fetchHistoryByCode(athlete.fisCode, lookbackLists);
  } catch {
    return { ok: false, error: "FIS is unreachable right now. Try again in a minute." };
  }
  if (snapshots.length === 0) {
    return { ok: false, error: `No FIS history found for code ${athlete.fisCode} across the last ${lookbackLists} lists.` };
  }

  // Upsert one row per (athlete, list, discipline). createMany would be
  // faster but Prisma's createMany doesn't honour the unique skip-on-conflict
  // semantic we need; the per-row upsert is fine at this volume (≤16 rows
  // per athlete per sync).
  let added = 0;
  const listsRead = new Set<number>();
  for (const s of snapshots) {
    listsRead.add(s.listid);
    const upserted = await prisma.fisListSnapshot.upsert({
      where: {
        athleteId_listid_discipline: {
          athleteId: athlete.id,
          listid: s.listid,
          discipline: s.discipline,
        },
      },
      update: { fisPoints: s.fisPoints, worldRank: s.worldRank ?? null, publishedAt: new Date(s.publishedAt), syncedAt: new Date() },
      create: {
        athleteId: athlete.id,
        listid: s.listid,
        publishedAt: new Date(s.publishedAt),
        discipline: s.discipline,
        fisPoints: s.fisPoints,
        worldRank: s.worldRank ?? null,
      },
      select: { id: true },
    }).catch(() => null);
    if (upserted) added += 1;
  }

  // Refresh anywhere the athlete profile / list shows points + trend.
  revalidatePath(`/dashboard/athletes/${athleteId}`);
  revalidatePath(`/dashboard/athletes`);

  // Latest publishedAt = the "as of" date the page should show.
  const lastPublishedAt = snapshots
    .map((s) => new Date(s.publishedAt).getTime())
    .reduce((m, t) => Math.max(m, t), 0);

  return {
    ok: true,
    snapshotsAdded: added,
    listsRead: listsRead.size,
    lastPublishedAt: lastPublishedAt ? new Date(lastPublishedAt).toISOString() : null,
  };
}

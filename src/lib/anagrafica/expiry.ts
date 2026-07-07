import { prisma } from "@/lib/db";
import { expiryStatus, type DocType, type ExpiryAlert, DOC_TYPE_META } from "./anagraficaTypes";

// Server read layer for anagrafica expiry alerts. Scans two sources per athlete:
//   • Athlete.fitTesseraExpiry / Athlete.ipinExpiry (federation membership)
//   • AthleteFile.expiresAt (typed documents: medical cert, passport, id, …)
// and returns everything expired or expiring within EXPIRY_WARN_DAYS, most
// urgent first — the FIT/iPin scadenza alert Max asked for.

// These columns are added additively; until the schema is pushed they don't
// exist. Degrade to empty so existing pages (OfficeDashboard) never break.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const code = (e as { code?: string })?.code;
    const msg = (e as { message?: string })?.message ?? "";
    if (code === "P2021" || code === "P2022" || /does not exist/i.test(msg)) return fallback;
    throw e;
  }
}

// Roster = athletes tied to this academy (ski enrollment ∪ tennis season plan).
async function rosterAthletes(academyId: string) {
  const [enr, plans] = await Promise.all([
    prisma.enrollment.findMany({ where: { academyId }, select: { athleteId: true } }),
    prisma.tennisSeasonPlan.findMany({ where: { academyId }, select: { athleteId: true } }),
  ]);
  return [...new Set([...enr.map((e) => e.athleteId), ...plans.map((p) => p.athleteId)])];
}

const DAY = 86_400_000;

function daysUntil(d: Date, now: number): number {
  return Math.ceil((d.getTime() - now) / DAY);
}

export async function getExpiryAlerts(academyId: string, now: number = Date.now()): Promise<ExpiryAlert[]> {
  const ids = await rosterAthletes(academyId);
  if (ids.length === 0) return [];

  const [athletes, files] = await Promise.all([
    safe(
      () => prisma.athlete.findMany({
        where: { id: { in: ids } },
        select: { id: true, firstName: true, lastName: true, fitTesseraExpiry: true, ipinExpiry: true },
      }),
      [] as { id: string; firstName: string; lastName: string; fitTesseraExpiry: Date | null; ipinExpiry: Date | null }[],
    ),
    safe(
      () => prisma.athleteFile.findMany({
        where: { academyId, athleteId: { in: ids }, expiresAt: { not: null } },
        select: { athleteId: true, docType: true, title: true, expiresAt: true },
      }),
      [] as { athleteId: string; docType: string | null; title: string; expiresAt: Date | null }[],
    ),
  ]);

  const nameById = new Map(athletes.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim()]));
  const alerts: ExpiryAlert[] = [];

  const push = (athleteId: string, kind: DocType, expiresAt: Date, source: ExpiryAlert["source"], nameFallback?: string) => {
    const daysLeft = daysUntil(expiresAt, now);
    const status = expiryStatus(daysLeft);
    if (status === "ok") return;
    alerts.push({
      athleteId,
      athleteName: nameById.get(athleteId) ?? nameFallback ?? "Atleta",
      kind,
      label: DOC_TYPE_META[kind].label,
      expiresAt: expiresAt.toISOString(),
      daysLeft,
      status,
      source,
    });
  };

  for (const a of athletes) {
    if (a.fitTesseraExpiry) push(a.id, "tessera_fitp", a.fitTesseraExpiry, "athlete");
    if (a.ipinExpiry) push(a.id, "ipin", a.ipinExpiry, "athlete");
  }
  for (const f of files) {
    if (!f.expiresAt) continue;
    const kind = (f.docType as DocType) || "other";
    push(f.athleteId, DOC_TYPE_META[kind] ? kind : "other", f.expiresAt, "file");
  }

  // Most urgent first (already-expired have the most negative daysLeft).
  alerts.sort((x, y) => x.daysLeft - y.daysLeft);
  return alerts;
}

export async function getExpiryCounts(academyId: string, now: number = Date.now()): Promise<{ expired: number; expiring: number }> {
  const alerts = await getExpiryAlerts(academyId, now);
  return {
    expired: alerts.filter((a) => a.status === "expired").length,
    expiring: alerts.filter((a) => a.status === "expiring").length,
  };
}

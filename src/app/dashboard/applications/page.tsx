import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { KanbanBoard, type Card } from "@/components/KanbanBoard";
import { getApplications, getAcademy } from "@/lib/queries";
import { getGroupsForAssignment } from "@/lib/ops";
import { age, type Status } from "@/lib/domain";
import { getActiveSeason } from "@/lib/season-server";
import { seasonBounds } from "@/lib/season";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const [allApps, academy, groups, season] = await Promise.all([getApplications(), getAcademy(), getGroupsForAssignment(), getActiveSeason()]);
  const bounds = seasonBounds(season);
  // Filter to applications submitted within the active season.
  const apps = allApps.filter((a) => +new Date(a.submittedAt) >= +bounds.start && +new Date(a.submittedAt) <= +bounds.end);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  const cards: Card[] = apps.map((a) => ({
    id: a.id,
    athleteId: a.athleteId,
    firstName: a.athlete.firstName,
    lastName: a.athlete.lastName,
    photoColor: a.athlete.photoColor,
    nationality: a.athlete.nationality,
    discipline: a.athlete.discipline,
    age: age(a.athlete.dob),
    fisPoints: a.athlete.fisPoints,
    status: a.status as Status,
    score: a.score,
    verified: a.athlete.verified,
    source: a.source,
    trend: a.trend,
    suggestedGroup: a.suggestedGroupId ? groupName.get(a.suggestedGroupId) ?? null : null,
  }));

  return (
    <>
      <PageHeader
        title="Applications"
        subtitle={`Season ${season} · drag candidates across the pipeline. Status changes are saved automatically.`}
        right={
          <div className="flex items-center gap-3">
            <span className="num text-sm text-[var(--color-muted)]">{cards.length} candidates</span>
            <Link
              href="/dashboard/recruiting"
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface)]"
            >
              Form &amp; openings
            </Link>
            {academy && (
              <Link
                href={`/academy/${academy.slug}`}
                target="_blank"
                className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface)]"
              >
                Public page ↗
              </Link>
            )}
          </div>
        }
      />
      <KanbanBoard initial={cards} />
    </>
  );
}

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { KanbanBoard, type Card } from "@/components/KanbanBoard";
import { getApplications, getAcademy } from "@/lib/queries";
import { getGroupsForAssignment } from "@/lib/ops";
import { age, type Status } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const [apps, academy, groups] = await Promise.all([getApplications(), getAcademy(), getGroupsForAssignment()]);
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
        subtitle="Drag candidates across the pipeline. Status changes are saved automatically."
        right={
          <div className="flex items-center gap-4">
            <span className="num text-sm text-[var(--color-muted)]">{cards.length} candidates</span>
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

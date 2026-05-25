import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { KanbanBoard, type Card } from "@/components/KanbanBoard";
import { ApplicationsTabs, resolveTab } from "@/components/ApplicationsTabs";
import { RecruitingSettings, type RecruitingValues } from "@/components/RecruitingSettings";
import { OpportunityManager, type OpportunityRow } from "@/components/OpportunityManager";
import { ApplyWithLeafEmbed } from "@/components/ApplyWithLeafEmbed";
import { ApplicationFormBuilder } from "@/components/ApplicationFormBuilder";
import { getApplications, getAcademy } from "@/lib/queries";
import { getGroupsForAssignment } from "@/lib/ops";
import { age, type Status } from "@/lib/domain";
import { getActiveSeason } from "@/lib/season-server";
import { seasonBounds } from "@/lib/season";
import { resolveApplicationFields } from "@/lib/applicationForm";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { RecruitingStatus } from "@/lib/profiles";

export const dynamic = "force-dynamic";

// Applications is the full intake module:
//   • Pipeline          — Kanban of every candidate from "new" → "accepted"
//   • Openings & form   — public form builder, openings, embed snippet
//   • Settings          — public recruiting visibility, deadlines, eligibility
// Recruiting used to live in its own route; that page now redirects here.
export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab = resolveTab(rawTab);

  // Pipeline (default) — every visitor can see it; openings + settings need admin.
  if (tab === "pipeline") return <PipelinePane />;

  await requireAdmin();
  if (tab === "openings") return <OpeningsPane />;
  return <SettingsPane />;
}

// ── Pipeline (default) ───────────────────────────────────────────────────
async function PipelinePane() {
  const [allApps, academy, groups, season] = await Promise.all([
    getApplications(),
    getAcademy(),
    getGroupsForAssignment(),
    getActiveSeason(),
  ]);
  const bounds = seasonBounds(season);
  const apps = allApps.filter(
    (a) => +new Date(a.submittedAt) >= +bounds.start && +new Date(a.submittedAt) <= +bounds.end,
  );
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
    playingStyle: a.athlete.playingStyle,
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
      <ApplicationsTabs active="pipeline" />
      <KanbanBoard initial={cards} sport={academy?.sport ?? "ski"} />
    </>
  );
}

// ── Openings & form ──────────────────────────────────────────────────────
async function OpeningsPane() {
  const session = await requireAdmin();
  const academy = session.academyId
    ? await prisma.academy.findUnique({ where: { id: session.academyId } })
    : null;
  if (!academy) {
    return (
      <>
        <ApplicationsHeader />
        <ApplicationsTabs active="openings" />
        <p className="p-8 text-sm text-[var(--color-muted)]">No academy in session.</p>
      </>
    );
  }

  const opps = await prisma.opportunity.findMany({
    where: { academyId: academy.id },
    include: { _count: { select: { applications: true } } },
    orderBy: { createdAt: "desc" },
  });
  const opportunities: OpportunityRow[] = opps.map((o) => ({
    id: o.id,
    title: o.title,
    type: o.type,
    season: o.season,
    ageGroup: o.ageGroup,
    discipline: o.discipline,
    packageType: o.packageType,
    price: o.price,
    currency: o.currency,
    pricePublic: o.pricePublic,
    applicationDeadline: o.applicationDeadline ? o.applicationDeadline.toISOString().slice(0, 10) : null,
    spotsAvailable: o.spotsAvailable,
    description: o.description,
    status: o.status,
    applicationsCount: o._count.applications,
  }));

  const appUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://leaf-saas-gbf8.vercel.app"}/academy/${academy.slug}/apply`;

  return (
    <>
      <ApplicationsHeader />
      <ApplicationsTabs active="openings" />
      <div className="max-w-3xl space-y-8 p-8">
        <ApplyWithLeafEmbed applyUrl={appUrl} />
        <OpportunityManager opportunities={opportunities} />
        <ApplicationFormBuilder initial={resolveApplicationFields(academy.applicationConfig)} />
      </div>
    </>
  );
}

// ── Recruiting settings (public visibility) ───────────────────────────────
async function SettingsPane() {
  const session = await requireAdmin();
  const academy = session.academyId
    ? await prisma.academy.findUnique({ where: { id: session.academyId } })
    : null;
  if (!academy) {
    return (
      <>
        <ApplicationsHeader />
        <ApplicationsTabs active="settings" />
        <p className="p-8 text-sm text-[var(--color-muted)]">No academy in session.</p>
      </>
    );
  }

  const initial: RecruitingValues = {
    slug: academy.slug,
    recruitingEnabled: academy.recruitingEnabled,
    recruitingStatus: academy.recruitingStatus as RecruitingStatus,
    publicRecruitingHeadline: academy.publicRecruitingHeadline,
    publicRecruitingDescription: academy.publicRecruitingDescription,
    season: academy.season,
    applicationDeadline: academy.applicationDeadline ? academy.applicationDeadline.toISOString().slice(0, 10) : null,
    availableSpots: academy.availableSpots,
    acceptedCountries: academy.acceptedCountries,
    ageCategories: academy.ageCategories,
    rankingRequirement: academy.rankingRequirement,
    programTypes: academy.programTypes ? academy.programTypes.split(",").map((s) => s.trim()).filter(Boolean) : [],
    applicationUrl: academy.applicationUrl,
    featuredAcademy: academy.featuredAcademy,
    contactEmail: academy.contactEmail,
    publicApplyEnabled: academy.publicApplyEnabled,
  };

  return (
    <>
      <ApplicationsHeader />
      <ApplicationsTabs active="settings" />
      <div className="max-w-3xl p-8">
        <RecruitingSettings initial={initial} />
      </div>
    </>
  );
}

// Shared header for the non-pipeline tabs (the pipeline tab has its own
// header with the candidate count + public-page button).
function ApplicationsHeader() {
  return (
    <PageHeader
      title="Applications"
      subtitle="Full intake flow — registration, eligibility, openings, form, approvals."
    />
  );
}

import { PageHeader } from "@/components/PageHeader";
import { RecruitingSettings, type RecruitingValues } from "@/components/RecruitingSettings";
import { OpportunityManager, type OpportunityRow } from "@/components/OpportunityManager";
import { ApplyWithLeafEmbed } from "@/components/ApplyWithLeafEmbed";
import { ApplicationFormBuilder } from "@/components/ApplicationFormBuilder";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveApplicationFields } from "@/lib/applicationForm";
import type { RecruitingStatus } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export default async function RecruitingPage() {
  const session = await requireAdmin();
  const academy = session.academyId ? await prisma.academy.findUnique({ where: { id: session.academyId } }) : null;
  if (!academy) return <div className="p-8 text-sm text-[var(--color-muted)]">No academy in session.</div>;

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
      <PageHeader
        title="Recruiting"
        subtitle={`${academy.name} · public recruiting on Leaf Profiles`}
      />
      <div className="max-w-3xl space-y-8 p-8">
        <ApplyWithLeafEmbed applyUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? "https://leaf-saas-gbf8.vercel.app"}/academy/${academy.slug}/apply`} />
        <OpportunityManager opportunities={opportunities} />
        <ApplicationFormBuilder initial={resolveApplicationFields(academy.applicationConfig)} />
        <RecruitingSettings initial={initial} />
      </div>
    </>
  );
}

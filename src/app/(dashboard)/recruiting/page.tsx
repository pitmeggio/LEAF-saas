import { PageHeader } from "@/components/PageHeader";
import { RecruitingSettings, type RecruitingValues } from "@/components/RecruitingSettings";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { RecruitingStatus } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export default async function RecruitingPage() {
  const session = await requireAdmin();
  const academy = session.academyId ? await prisma.academy.findUnique({ where: { id: session.academyId } }) : null;
  if (!academy) return <div className="p-8 text-sm text-[var(--color-muted)]">No academy in session.</div>;

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
      <div className="max-w-3xl p-8">
        <RecruitingSettings initial={initial} />
      </div>
    </>
  );
}

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { AthletesExplorer, type Row } from "@/components/AthletesExplorer";
import { getAthletes } from "@/lib/queries";
import { age } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function AthletesPage() {
  const athletes = await getAthletes();
  const rows: Row[] = athletes.map((a) => ({
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    photoColor: a.photoColor,
    nationality: a.nationality,
    gender: a.gender ?? "",
    discipline: a.discipline,
    age: age(a.dob),
    fisPoints: a.fisPoints,
    worldRank: a.worldRank,
    verified: a.verified,
    trend: a.trend,
  }));

  return (
    <>
      <PageHeader
        title="Athletes"
        subtitle="Discover and filter your candidate pool by performance and growth."
        right={
          <Link
            href="/athletes/import"
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]"
          >
            + Import from FIS
          </Link>
        }
      />
      <AthletesExplorer rows={rows} />
    </>
  );
}

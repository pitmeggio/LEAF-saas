import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, TrendArrow, Verified, StatusBadge } from "@/components/ui";
import { GrowthChart, type Point } from "@/components/GrowthChart";
import { getAthlete } from "@/lib/queries";
import { DISCIPLINE_LABEL, COUNTRY, age, fmtDate, fmtPoints, type Status } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function AthleteProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ imported?: string }>;
}) {
  const { id } = await params;
  const { imported } = await searchParams;
  const a = await getAthlete(id);
  if (!a) notFound();

  const chart: Point[] = a.rankings.map((r) => ({
    label: new Date(r.date).toLocaleDateString("en-GB", { month: "short" }),
    fisPoints: r.fisPoints,
  }));

  const Stat = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
    <div className="card-2 p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="mt-1 num text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-[var(--color-muted)]">{sub}</div>}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Athlete profile"
        subtitle="FIS-verified sports CV · auto-imported"
        right={
          <Link href="/athletes" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            ← Back to athletes
          </Link>
        }
      />

      <div className="space-y-6 p-8">
        {imported && (
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{ background: "#7cff6b14", borderColor: "#7cff6b40", color: "#7cff6b" }}
          >
            ✓ Profile {imported === "new" ? "created" : "updated"} from FIS — points, history and results imported.
          </div>
        )}
        {/* Hero */}
        <div className="card flex flex-col gap-5 p-6 md:flex-row md:items-center">
          <Avatar first={a.firstName} last={a.lastName} color={a.photoColor} size={88} />
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">
                {a.firstName} {a.lastName}
              </h2>
              {a.verified && <Verified />}
            </div>
            <div className="mt-1 text-sm text-[var(--color-muted)]">
              {COUNTRY[a.nationality]?.flag} {COUNTRY[a.nationality]?.name} · {age(a.dob)} years ·{" "}
              {DISCIPLINE_LABEL[a.discipline]} · {a.location}
            </div>
            {a.bio && <p className="mt-3 max-w-2xl text-sm text-[var(--color-fg)]/90">{a.bio}</p>}
            {a.fisCode && (
              <div className="num mt-3 text-xs text-[var(--color-muted)]">FIS code: {a.fisCode}</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:w-72">
            <Stat label="FIS points" value={fmtPoints(a.fisPoints)} sub="lower = better" />
            <Stat label="World rank" value={a.worldRank ?? "—"} />
            <div className="card-2 col-span-2 flex items-center justify-between p-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">12-month trend</div>
                <div className="text-xs text-[var(--color-muted)]">
                  −{a.trend.deltaPoints} FIS pts
                </div>
              </div>
              <TrendArrow trend={a.trend} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Growth chart */}
          <div className="card p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Growth trend · FIS points (12 months)</h3>
              <TrendArrow trend={a.trend} />
            </div>
            {chart.length > 1 ? (
              <GrowthChart data={chart} />
            ) : (
              <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-center text-sm text-[var(--color-muted)]">
                No FIS history yet.
                <span className="text-xs">Import a FIS code to build the growth trend automatically.</span>
              </div>
            )}
          </div>

          {/* Applications + media */}
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="mb-3 text-sm font-semibold">Applications</h3>
              {a.applications.length === 0 && <p className="text-sm text-[var(--color-muted)]">No applications.</p>}
              <div className="space-y-2">
                {a.applications.map((app) => (
                  <Link
                    key={app.id}
                    href={`/applications/${app.id}`}
                    className="flex items-center justify-between rounded-lg p-2 hover:bg-[var(--color-surface-2)]"
                  >
                    <span className="text-sm">{app.program?.name ?? "General"}</span>
                    <StatusBadge status={app.status as Status} />
                  </Link>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="mb-3 text-sm font-semibold">Media</h3>
              <div className="space-y-2">
                {a.media.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-2)] p-2">
                    <div className="flex h-9 w-14 items-center justify-center rounded-md bg-black/40 text-xs">▶</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{m.title}</div>
                      <div className="text-xs text-[var(--color-muted)]">{m.duration}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-5 py-4">
            <h3 className="text-sm font-semibold">Recent results</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Event</th>
                <th className="px-3 py-3 font-medium">Location</th>
                <th className="px-3 py-3 font-medium">Rank</th>
                <th className="px-3 py-3 font-medium">FIS pts</th>
              </tr>
            </thead>
            <tbody>
              {a.results.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-border)]">
                  <td className="px-5 py-3 text-[var(--color-muted)]">{fmtDate(r.date)}</td>
                  <td className="px-3 py-3">{r.eventName}</td>
                  <td className="px-3 py-3 text-[var(--color-muted)]">{r.location}</td>
                  <td className="num px-3 py-3 font-semibold">{r.rank}</td>
                  <td className="num px-3 py-3">{r.fisPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

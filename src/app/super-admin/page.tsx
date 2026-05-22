import Link from "next/link";
import { getAcademiesWithMetrics, getPlatformTotals } from "@/lib/superadmin";
import { COUNTRY } from "@/lib/domain";
import {
  CreateAcademyButton, EditAcademyButton, PlanSelect, StatusToggle, StatusBadge, ConfigureAcademyButton,
} from "@/components/SuperAdmin";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const [academies, totals] = await Promise.all([getAcademiesWithMetrics(), getPlatformTotals()]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academies</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Manage every tenant on the platform.</p>
        </div>
        <CreateAcademyButton />
      </div>

      {/* Platform totals */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Academies" value={totals.academies} />
        <Stat label="Active" value={totals.active} />
        <Stat label="Total users" value={totals.users} />
        <Stat label="Enrolled athletes" value={totals.athletes} />
      </div>

      {/* Academy list */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <th className="px-5 py-3 font-medium">Academy</th>
              <th className="px-3 py-3 font-medium">Plan</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 text-right font-medium">Users</th>
              <th className="px-3 py-3 text-right font-medium">Athletes</th>
              <th className="px-3 py-3 text-right font-medium">Apps</th>
              <th className="px-3 py-3 text-right font-medium">Coaches</th>
              <th className="px-3 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {academies.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">No academies yet. Create the first one.</td></tr>
            )}
            {academies.map((a) => (
              <tr key={a.id} className="border-t border-[var(--color-border)] first:border-t-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black" style={{ background: a.logoColor, color: "#0a0c10" }}>{a.name[0]}</div>
                    <div className="leading-tight">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-[var(--color-muted)]">{COUNTRY[a.country]?.flag} /academy/{a.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3"><PlanSelect id={a.id} plan={a.plan} /></td>
                <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                <td className="num px-3 py-3 text-right">{a.metrics.users}</td>
                <td className="num px-3 py-3 text-right">{a.metrics.athletes}</td>
                <td className="num px-3 py-3 text-right">{a.metrics.applications}</td>
                <td className="num px-3 py-3 text-right">{a.metrics.coaches}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/academy/${a.slug}`} target="_blank" className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-2)]">View ↗</Link>
                    <StatusToggle id={a.id} status={a.status} />
                    <ConfigureAcademyButton academy={{ id: a.id, name: a.name, tagline: a.tagline, description: a.description, contactEmail: a.contactEmail, logoColor: a.logoColor, maxAthletes: a.maxAthletes, requiredDocs: a.requiredDocs, currency: a.currency, featureRecruiting: a.featureRecruiting, featurePublicProfiles: a.featurePublicProfiles, featureFinance: a.featureFinance, featureChat: a.featureChat }} />
                    <EditAcademyButton academy={{ id: a.id, name: a.name, slug: a.slug, logoColor: a.logoColor, status: a.status, plan: a.plan }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
      <div className="num mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

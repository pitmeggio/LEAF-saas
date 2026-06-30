import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, Dot } from "@/components/StatCard";
import { computeAlerts } from "@/lib/ops";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SEV_COLOR = { high: "#f87171", medium: "#f59e0b", low: "#8a93a6" } as const;
const SEV_LABEL = { high: "High", medium: "Medium", low: "Low" } as const;

export default async function AlertsPage() {
  const s = await getSession();
  const alerts = await computeAlerts(s?.isAdmin ? null : s?.coachId ?? null);
  const high = alerts.filter((a) => a.severity === "high").length;
  const medium = alerts.filter((a) => a.severity === "medium").length;
  const low = alerts.filter((a) => a.severity === "low").length;

  return (
    <>
      <PageHeader title="Avvisi" subtitle="Generati in automatico dai dati dell'academy — nessun inserimento manuale." />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Open alerts" value={String(alerts.length)} />
          <StatCard label="High" value={String(high)} danger={high > 0} />
          <StatCard label="Medium" value={String(medium)} />
          <StatCard label="Low" value={String(low)} />
        </div>

        <div className="card divide-y divide-[var(--color-border)]">
          {alerts.length === 0 && <div className="p-8 text-center text-sm text-[var(--color-muted)]">No alerts — everything is on track.</div>}
          {alerts.map((a) => (
            <Link key={a.id} href={a.href ?? "#"} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-surface-2)]">
              <Dot color={SEV_COLOR[a.severity]} />
              <div className="flex-1">
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-xs text-[var(--color-muted)]">{a.detail}</div>
              </div>
              <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: `${SEV_COLOR[a.severity]}1a`, color: SEV_COLOR[a.severity] }}>
                {SEV_LABEL[a.severity]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

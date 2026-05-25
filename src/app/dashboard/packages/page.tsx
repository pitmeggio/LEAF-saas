import { PageHeader } from "@/components/PageHeader";
import { PercentBar } from "@/components/StatCard";
import { Modal, PackageForm, DeleteButton } from "@/components/EntityForms";
import { FinanceSubNav } from "@/components/FinanceSubNav";
import { getPackagesWithStats, getAcademyCurrency } from "@/lib/ops";
import { requireAdmin } from "@/lib/auth";
import { fmtMoney } from "@/lib/domain";

export const dynamic = "force-dynamic";

const FREQ_LABEL: Record<string, string> = { one_time: "One-time", monthly: "Monthly", seasonal: "Seasonal" };
const newBtn = "rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]";

export default async function PackagesPage() {
  await requireAdmin();
  const [packages, currency] = await Promise.all([getPackagesWithStats(), getAcademyCurrency()]);
  // Forecast in the academy's base currency only (don't sum across currencies).
  const totalForecast = packages.filter((p) => p.currency === currency).reduce((s, p) => s + p.contractValue, 0);

  return (
    <>
      <PageHeader
        title="Packages / Subscriptions"
        subtitle="Product catalogue — occupancy, active subscriptions and revenue forecast update automatically."
        right={
          <div className="flex items-center gap-3">
            <span className="num text-sm text-[var(--color-muted)]">Forecast {fmtMoney(totalForecast, currency)}</span>
            <Modal label="+ New package" title="New package" className={newBtn}><PackageForm /></Modal>
          </div>
        }
      />
      <FinanceSubNav active="packages" />
      <div className="grid gap-4 p-8 md:grid-cols-2">
        {packages.map((p) => (
          <div key={p.id} className="card p-6" style={p.full ? { borderColor: "#f59e0b" } : undefined}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold">{p.name}</div>
                <div className="text-xs text-[var(--color-muted)]">{FREQ_LABEL[p.billingFreq] ?? p.billingFreq} · {p.active ? "Active" : "Inactive"}</div>
              </div>
              <div className="text-right">
                <div className="num text-xl font-bold">{fmtMoney(p.price, p.currency)}</div>
                <div className="text-[10px] text-[var(--color-muted)]">per {p.period}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.coaching && <Tag>Coaching</Tag>}
              {p.raceSupport && <Tag>Race support</Tag>}
              {p.accommodation && <Tag>Accommodation</Tag>}
              {p.transport && <Tag>Transport</Tag>}
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--color-muted)]">Subscriptions</span>
                <span className="num">{p.activeCount}{p.maxAthletes ? `/${p.maxAthletes}` : ""}{p.full ? " · FULL" : ""}</span>
              </div>
              {p.occupancyPct != null && <PercentBar value={p.occupancyPct} color={p.full ? "#f59e0b" : "var(--color-accent)"} />}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-sm">
              <span className="text-[var(--color-muted)]">Revenue forecast</span>
              <span className="num font-semibold">{fmtMoney(p.contractValue, p.currency)}</span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Modal label="Edit" title="Edit package" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
                <PackageForm initial={{ id: p.id, name: p.name, description: p.description, price: p.price, currency: p.currency, period: p.period, billingFreq: p.billingFreq, features: p.features, accommodation: p.accommodation, transport: p.transport, coaching: p.coaching, raceSupport: p.raceSupport, maxAthletes: p.maxAthletes, active: p.active }} />
              </Modal>
              <DeleteButton kind="package" id={p.id} label="Delete" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">{children}</span>;
}

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, PercentBar, Dot } from "@/components/StatCard";
import { getFinance } from "@/lib/ops";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PaymentControl } from "@/components/MemberControls";
import { FinanceConnection } from "@/components/FinanceConnection";
import { isExternalFinance } from "@/lib/finance";
import { fmtMoney, fmtDate, effectivePaymentStatus, effectiveInvoiceStatus, PAYMENT_STATUS_COLOR, INVOICE_STATUS_COLOR } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const session = await requireAdmin();
  const academy = session.academyId ? await prisma.academy.findUnique({ where: { id: session.academyId }, select: { financeProvider: true, financeSyncedAt: true } }) : null;
  const external = isExternalFinance(academy?.financeProvider);
  const f = await getFinance();
  const rows = [...f.payments].sort((a, b) => {
    const ao = effectivePaymentStatus(a) === "overdue" ? 0 : 1;
    const bo = effectivePaymentStatus(b) === "overdue" ? 0 : 1;
    return ao - bo || +new Date(a.dueDate) - +new Date(b.dueDate);
  });

  return (
    <>
      <PageHeader title="Payments & Invoices" subtitle={external ? "Read-only view — invoices and payments are synced from your connected finance system." : "Invoices, balances, overdue and forecasts update automatically as payments are recorded."} />

      <div className="space-y-6 p-8">
        <FinanceConnection
          provider={academy?.financeProvider ?? null}
          syncedAt={academy?.financeSyncedAt ? academy.financeSyncedAt.toLocaleString() : null}
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Collected" value={fmtMoney(f.collected)} hint="paid to date" accent />
          <StatCard label="Outstanding" value={fmtMoney(f.outstandingTotal)} hint="billed, not yet paid" danger={f.outstandingTotal > 0} />
          <StatCard label="Overdue" value={fmtMoney(f.overdueTotal)} hint={`past due · ${f.unpaidAthletes} athlete(s)`} danger={f.overdueTotal > 0} />
          <StatCard label="Paid this month" value={fmtMoney(f.paidThisMonth)} hint="collected this month" />
          <StatCard label="Active subscriptions" value={String(f.activeSubscriptions)} hint="athletes on a package" />
          <StatCard label="Monthly recurring" value={fmtMoney(f.monthlyRecurringEstimate)} hint="expected income / month" />
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">Invoice states</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            {Object.entries(f.invoiceStates).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1.5 capitalize">
                <Dot color={INVOICE_STATUS_COLOR[k] ?? "#8a93a6"} /> {k}: <span className="num font-semibold">{v}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">Revenue by package</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {f.packageBreakdown.map((p) => {
              const pct = f.totalContract ? (p.revenue / f.totalContract) * 100 : 0;
              return (
                <div key={p.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>{p.name} <span className="text-[var(--color-muted)]">· {p.count} active</span></span>
                    <span className="num">{fmtMoney(p.revenue, p.currency)}</span>
                  </div>
                  <PercentBar value={pct} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-5 py-4"><h2 className="text-sm font-semibold">Invoices &amp; payments</h2></div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <th className="px-5 py-3 font-medium">Invoice</th><th className="px-3 py-3 font-medium">Athlete</th><th className="px-3 py-3 font-medium">Item</th><th className="px-3 py-3 font-medium">Amount</th><th className="px-3 py-3 font-medium">Outstanding</th><th className="px-3 py-3 font-medium">Due</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Action</th>
            </tr></thead>
            <tbody>
              {rows.map((p) => {
                const inv = p.invoice;
                const ist = inv ? effectiveInvoiceStatus(inv, p) : effectivePaymentStatus(p);
                const ath = p.enrollment.athlete;
                const outstanding = p.amount - p.paidAmount;
                return (
                  <tr key={p.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]" style={ist === "overdue" ? { boxShadow: "inset 2px 0 0 #f87171" } : undefined}>
                    <td className="num px-5 py-3 text-xs">{inv?.number ?? "—"}<div className="text-[10px] text-[var(--color-muted)]">{p.enrollment.package?.name ?? ""}</div></td>
                    <td className="px-3 py-3">
                      <Link href={`/dashboard/members/${p.enrollmentId}`} className="font-medium hover:underline">{ath.firstName} {ath.lastName}</Link>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-muted)]">{p.label}</td>
                    <td className="num px-3 py-3 font-semibold">{fmtMoney(p.amount, p.currency)}</td>
                    <td className="num px-3 py-3" style={{ color: outstanding > 0 ? "#f59e0b" : "#7CFF6B" }}>{fmtMoney(outstanding, p.currency)}</td>
                    <td className="px-3 py-3 text-xs text-[var(--color-muted)]">{fmtDate(p.dueDate)}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize" style={{ color: INVOICE_STATUS_COLOR[ist] ?? PAYMENT_STATUS_COLOR[ist] }}>
                        <Dot color={INVOICE_STATUS_COLOR[ist] ?? "#8a93a6"} /> {ist}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {p.source === "external" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-2)] px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]" title="Synced from your finance system — read-only">⟳ Synced</span>
                      ) : (
                        <PaymentControl paymentId={p.id} status={p.status} amount={p.amount} paidAmount={p.paidAmount} currency={p.currency} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

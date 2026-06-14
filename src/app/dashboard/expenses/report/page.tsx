import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, requireAcademyId } from "@/lib/auth";
import { fmtMoney, fmtDate } from "@/lib/domain";
import { PrintButton } from "@/components/PrintButton";
import { splitVat, vatLabel, PAYMENT_METHODS } from "@/lib/accounting";

export const dynamic = "force-dynamic";

const PM_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.value, p.label]));

// Printable accountant report — admin only. Renders an expense bundle for a
// period (line items + VAT summary + receipt thumbnails), styled for the
// browser's Save-as-PDF. The CSV export covers machine import; this is the
// human-readable bilag bundle the regnskapsfører can file.
export default async function ExpenseReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const s = await getSession();
  if (!s?.isAdmin) notFound();
  const academyId = await requireAcademyId();
  const { from: fromStr, to: toStr } = await searchParams;
  const from = fromStr ? new Date(fromStr) : null;
  const to = toStr ? new Date(`${toStr}T23:59:59`) : null;

  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { name: true, country: true, currency: true } });
  const currency = academy?.currency ?? "EUR";
  const vlabel = vatLabel(academy?.country);

  const all = await prisma.expense.findMany({
    where: { academyId },
    include: { coach: { select: { name: true } }, group: { select: { name: true } }, receipts: { select: { id: true, fileMime: true } } },
    orderBy: { createdAt: "asc" },
  });
  const expenses = all.filter((e) => {
    const d = e.expenseDate ?? e.createdAt;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  // VAT summary, grouped by rate.
  const byRate = new Map<number, { net: number; vat: number; gross: number }>();
  let totNet = 0, totVat = 0, totGross = 0;
  for (const e of expenses) {
    const { net, vat } = splitVat(e.amount, e.vatRate);
    const r = e.vatRate ?? 0;
    const cur = byRate.get(r) ?? { net: 0, vat: 0, gross: 0 };
    cur.net += net; cur.vat += vat; cur.gross += e.amount;
    byRate.set(r, cur);
    totNet += net; totVat += vat; totGross += e.amount;
  }
  const rates = [...byRate.keys()].sort((a, b) => b - a);

  const periodLabel = fromStr || toStr ? `${fromStr ?? "start"} → ${toStr ?? "today"}` : "All time";

  return (
    <div className="mx-auto max-w-4xl p-8 print:p-0 text-[var(--color-fg)] print:text-black">
      <style>{`@media print { aside, .no-print { display: none !important; } body { background: white !important; } main { margin: 0 !important; } }`}</style>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expense report</h1>
          <p className="text-sm text-[var(--color-muted)] print:text-gray-600">{academy?.name} · {periodLabel}</p>
        </div>
        <div className="no-print flex gap-2">
          <Link href="/dashboard/expenses" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-surface-2)]">← Back</Link>
          <PrintButton className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[#0a0c10]" />
        </div>
      </div>

      {/* VAT summary */}
      <div className="mb-6 rounded-lg border border-[var(--color-border)] p-4 print:border-gray-300">
        <h2 className="mb-2 text-sm font-semibold">{vlabel} summary</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)] print:text-gray-500">
            <th className="py-1 font-medium">{vlabel} rate</th><th className="py-1 text-right font-medium">Net</th><th className="py-1 text-right font-medium">{vlabel}</th><th className="py-1 text-right font-medium">Gross</th>
          </tr></thead>
          <tbody>
            {rates.map((r) => {
              const v = byRate.get(r)!;
              return (
                <tr key={r} className="border-t border-[var(--color-border)] print:border-gray-200">
                  <td className="py-1">{r}%</td>
                  <td className="num py-1 text-right">{fmtMoney(v.net, currency)}</td>
                  <td className="num py-1 text-right">{fmtMoney(v.vat, currency)}</td>
                  <td className="num py-1 text-right">{fmtMoney(v.gross, currency)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-[var(--color-border)] font-semibold print:border-gray-400">
              <td className="py-1">Total</td>
              <td className="num py-1 text-right">{fmtMoney(totNet, currency)}</td>
              <td className="num py-1 text-right">{fmtMoney(totVat, currency)}</td>
              <td className="num py-1 text-right">{fmtMoney(totGross, currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Line items */}
      <table className="w-full text-xs">
        <thead><tr className="text-left uppercase tracking-wide text-[var(--color-muted)] print:text-gray-500">
          <th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Description</th><th className="py-2 font-medium">Account</th><th className="py-2 font-medium">Coach</th><th className="py-2 text-right font-medium">Net</th><th className="py-2 text-right font-medium">{vlabel}</th><th className="py-2 text-right font-medium">Gross</th><th className="py-2 font-medium">Receipt</th>
        </tr></thead>
        <tbody>
          {expenses.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-[var(--color-muted)]">No expenses in this period.</td></tr>}
          {expenses.map((e) => {
            const { net, vat } = splitVat(e.amount, e.vatRate);
            return (
              <tr key={e.id} className="border-t border-[var(--color-border)] align-top print:border-gray-200">
                <td className="py-2 whitespace-nowrap">{fmtDate(e.expenseDate ?? e.createdAt)}</td>
                <td className="py-2">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-[10px] text-[var(--color-muted)] print:text-gray-500">
                    {e.kind === "mileage" ? `${e.distanceKm ?? 0} km · ${e.fromPlace ?? ""}→${e.toPlace ?? ""}` : (e.supplier ?? e.category.replace(/_/g, " "))}
                    {e.paymentMethod ? ` · ${PM_LABEL[e.paymentMethod] ?? e.paymentMethod}` : ""} · {e.status}
                  </div>
                </td>
                <td className="py-2">{e.accountCode ?? "—"}</td>
                <td className="py-2">{e.coach?.name ?? "Academy"}</td>
                <td className="num py-2 text-right">{fmtMoney(net, e.currency)}</td>
                <td className="num py-2 text-right">{fmtMoney(vat, e.currency)}</td>
                <td className="num py-2 text-right font-semibold">{fmtMoney(e.amount, e.currency)}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {e.receipts.map((r) => (
                      r.fileMime.startsWith("image/") && r.fileMime !== "image/heic"
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img key={r.id} src={`/api/expenses/receipt/${r.id}`} alt="receipt" className="h-12 w-12 rounded border border-[var(--color-border)] object-cover print:border-gray-300" />
                        : <a key={r.id} href={`/api/expenses/receipt/${r.id}`} target="_blank" rel="noopener" className="rounded border border-[var(--color-border)] px-1.5 py-1 text-[9px] print:border-gray-300">PDF</a>
                    ))}
                    {e.receipts.length === 0 && <span className="text-[var(--color-muted)]/60">—</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-8 text-[10px] text-[var(--color-muted)] print:text-gray-400">
        Generated by LEAF · {academy?.name} · This report and its attached receipts constitute the expense documentation (bilag) for the period above.
      </p>
    </div>
  );
}

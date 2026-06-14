import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Modal, ExpenseForm } from "@/components/EntityForms";
import { ExpenseCoachActions, ExpenseAdminActions } from "@/components/EntityActions";
import { FinanceSubNav } from "@/components/FinanceSubNav";
import { getExpenses, getAssignmentOptions, getAcademyCurrency } from "@/lib/ops";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtMoney, fmtDate } from "@/lib/domain";

export const dynamic = "force-dynamic";

const newBtn = "rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]";
const STATUS_COLOR: Record<string, string> = { draft: "#8a93a6", submitted: "#f59e0b", approved: "#7CFF6B", rejected: "#f87171", reimbursed: "#38bdf8" };

export default async function ExpensesPage() {
  const s = await getSession();
  const isAdmin = s?.isAdmin ?? false;
  const coachId = isAdmin ? null : s?.coachId ?? null;
  const [data, currency] = await Promise.all([getExpenses(coachId), getAcademyCurrency()]);

  // Coach can only file against their own groups; admin sees all groups.
  const academyId = s?.academyId ?? "";
  const groups = await prisma.group.findMany({
    where: { academyId, ...(coachId ? { coachId } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title={isAdmin ? "Expenses & Approvals" : "My Expenses"}
        subtitle={isAdmin ? "Approve, reject and reimburse coach expenses. The approvals queue lives here." : "File and track your expense claims."}
        right={!isAdmin ? <Modal label="+ New expense" title="New expense" className={newBtn}><ExpenseForm groups={groups} currency={currency} /></Modal> : undefined}
      />
      {isAdmin && <FinanceSubNav active="expenses" />}
      <div className="space-y-6 p-8">
        {/* "Replaces Power Office" banner — by request. Marius wanted the
            surface to communicate the positioning so the team understands
            this IS the gestionale-costi flow now. Admins see it; coaches
            don't (they only file, they don't manage). */}
        {isAdmin && (
          <div className="card flex items-start gap-3 p-4">
            <span aria-hidden className="mt-0.5 text-lg">€</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                Your operativo cost ledger
                <span className="ml-2 rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
                  Replaces Power Office
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                Every coach receipt, every team expense, every reimbursement. Categorised,
                approval queue, audit trail and reimbursement state — all reconciled
                with the group budgets in Finance. No double-entry in another tool.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Pending approval" value={String(data.pendingCount)} hint={fmtMoney(data.submittedTotal, currency)} danger={data.pendingCount > 0} />
          <StatCard label="Approved" value={fmtMoney(data.approvedTotal, currency)} accent />
          <StatCard label="Reimbursed" value={fmtMoney(data.reimbursedTotal, currency)} />
          <StatCard label="Total claims" value={String(data.expenses.length)} />
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <th className="px-5 py-3 font-medium">Expense</th>
                {isAdmin && <th className="px-3 py-3 font-medium">Coach</th>}
                <th className="px-3 py-3 font-medium">Group</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.expenses.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">No expenses yet.</td></tr>
              )}
              {data.expenses.map((e) => (
                <tr key={e.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-3">
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-[var(--color-muted)] capitalize">
                      {e.category.replace(/_/g, " ")} · {fmtDate(e.expenseDate ?? e.createdAt)}
                      {e.receiptUrl && <> · <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">receipt ↗</a></>}
                    </div>
                    {e.approvedBy && (e.status === "approved" || e.status === "reimbursed" || e.status === "rejected") && (
                      <div className="text-[10px] text-[var(--color-muted)]">{e.status === "rejected" ? "Rejected" : "Approved"} by {e.approvedBy.name}{e.approvedAt ? ` · ${fmtDate(e.approvedAt)}` : ""}</div>
                    )}
                  </td>
                  {isAdmin && <td className="px-3 py-3 text-[var(--color-muted)]">{e.coach?.name ?? "Academy"}</td>}
                  <td className="px-3 py-3 text-[var(--color-muted)]">{e.group?.name ?? "—"}</td>
                  <td className="num px-3 py-3 font-semibold">{fmtMoney(e.amount, e.currency)}</td>
                  <td className="px-3 py-3"><span className="text-xs font-medium capitalize" style={{ color: STATUS_COLOR[e.status] }}>{e.status}</span></td>
                  <td className="px-3 py-3">{isAdmin ? <ExpenseAdminActions id={e.id} status={e.status} /> : <ExpenseCoachActions id={e.id} status={e.status} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

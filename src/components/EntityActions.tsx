"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveCoach } from "@/app/entity-actions";
import { submitExpense, deleteExpense, setExpenseStatus } from "@/app/expense-actions";

const btn = "rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50";

export function ArchiveCoachButton({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button disabled={pending} className={btn} onClick={() => start(async () => { await archiveCoach(id); router.refresh(); })}>
      {pending ? "…" : active ? "Archive" : "Reactivate"}
    </button>
  );
}

function useRun() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return { pending, run: (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); }) };
}

// Coach-side: submit a draft / delete a draft.
export function ExpenseCoachActions({ id, status }: { id: string; status: string }) {
  const { pending, run } = useRun();
  if (status !== "draft") return <span className="text-xs text-[var(--color-muted)] capitalize">{status}</span>;
  return (
    <div className="flex gap-2">
      <button disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50" onClick={() => run(() => submitExpense(id))}>Submit</button>
      <button disabled={pending} className={btn} onClick={() => { if (confirm("Delete draft?")) run(() => deleteExpense(id)); }}>Delete</button>
    </div>
  );
}

// Admin-side: approve / reject / mark reimbursed.
export function ExpenseAdminActions({ id, status }: { id: string; status: string }) {
  const { pending, run } = useRun();
  if (status === "draft") return <span className="text-xs text-[var(--color-muted)]">draft (coach)</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {status === "submitted" && (
        <>
          <button disabled={pending} className="rounded-lg border border-[#7CFF6B40] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[#7cff6b12] disabled:opacity-50" onClick={() => run(() => setExpenseStatus(id, "approved"))}>Approve</button>
          <button disabled={pending} className="rounded-lg border border-[#f8717140] px-3 py-1.5 text-xs font-medium text-[#f87171] hover:bg-[#f8717112] disabled:opacity-50" onClick={() => run(() => setExpenseStatus(id, "rejected"))}>Reject</button>
        </>
      )}
      {status === "approved" && (
        <button disabled={pending} className={btn} onClick={() => run(() => setExpenseStatus(id, "reimbursed"))}>Mark reimbursed</button>
      )}
      {(status === "rejected" || status === "reimbursed") && <span className="text-xs text-[var(--color-muted)] capitalize">{status}</span>}
    </div>
  );
}

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCoachTimesheets, getAcademyTimesheets } from "@/lib/timesheets/timesheets";
import { getAcademyCurrency } from "@/lib/ops";
import { TimesheetManager } from "@/components/TimesheetManager";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

function money(v: number, currency: string): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

// Foglio ore & Stipendi. Coaches submit + track their own; admin/office review
// every coach's hours, approve, mark paid, and see the salary rollup.
export default async function TimesheetsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.isSuperAdmin) redirect("/super-admin");
  if (s.isAthlete) redirect("/app");

  const currency = await getAcademyCurrency();
  const isStaff = s.isAdmin || s.isOffice;

  if (isStaff) {
    const data = await getAcademyTimesheets(s.academyId!);
    return (
      <>
        <PageHeader title="Foglio ore & Stipendi" subtitle="Ore dei maestri, approvazione e riepilogo compensi." />
        <div className="space-y-6 p-8">
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Ore totali" value={String(Math.round(data.totalHours))} icon={Clock} />
            <StatCard label="Compensi totali" value={money(data.totalAmount, currency)} />
            <StatCard label="Da pagare" value={money(data.unpaidAmount, currency)} danger={data.unpaidAmount > 0} />
            <StatCard label="Da approvare" value={String(data.pendingApproval)} accent={data.pendingApproval > 0} />
          </div>

          {data.byCoach.length > 0 && (
            <div>
              <div className="kicker mb-3">Per maestro</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.byCoach.map((c) => (
                  <div key={c.coachId} className="card p-4">
                    <div className="font-semibold">{c.coachName}</div>
                    <div className="mt-1 flex items-end justify-between">
                      <div className="text-[11px] text-[var(--color-muted)]"><span className="num">{Math.round(c.hours)}</span> ore · {c.count} fogli</div>
                      <div className="num text-lg font-bold">{money(c.amount, currency)}</div>
                    </div>
                    {c.unpaid > 0 && <div className="mt-1 text-[11px] text-[#f59e0b]">{money(c.unpaid, currency)} da pagare</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="kicker mb-3">Tutti i fogli ore</div>
            <TimesheetManager rows={data.rows} currency={currency} canSubmit={false} canManage />
          </div>
        </div>
      </>
    );
  }

  // Coach view — their own foglio ore + submit.
  const rows = s.coachId ? await getCoachTimesheets(s.coachId) : [];
  return (
    <>
      <PageHeader title="Il mio foglio ore" subtitle="Invia le ore del mese — lo stipendio si calcola in automatico." />
      <div className="space-y-6 p-8">
        <TimesheetManager rows={rows} currency={currency} canSubmit canManage={false} />
      </div>
    </>
  );
}

import { PageHeader } from "@/components/PageHeader";
import { UtilizationCharts } from "@/components/UtilizationCharts";
import { getSession, requireAcademyId } from "@/lib/auth";
import { getActiveSeason } from "@/lib/season-server";
import { getUtilizationReport } from "@/lib/utilization";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// LEAF OS Essential — Utilization & Reports.
//
// Two stories on one page:
//   • Pay-and-Train customer flow — annual + seasonal, how revenue ticks up
//   • Line utilization — which slopes/lines/days/slots get used, by whom
//
// The AI-style narrative on top is deterministic (no LLM call). It reads
// the same aggregates the charts render and writes 3-5 sentences in plain
// English. That keeps it fast, audit-safe, and offline-capable.
export default async function UtilizationPage() {
  const s = await getSession();
  const academyId = await requireAcademyId();
  const isAdmin = s?.isAdmin ?? false;
  const season = await getActiveSeason();
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true, name: true } });
  const currency = academy?.currency ?? "EUR";

  const report = await getUtilizationReport(academyId, season, currency);

  return (
    <>
      <PageHeader
        title="Utilization & Reports"
        subtitle={`Season ${season} · how your slopes are used and where Pay-and-Train demand comes from.`}
      />
      <div className="space-y-6 p-8">
        {/* AI-style narrative on top — the headline Marius shows the board. */}
        <div className="card relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--color-accent)]/10 blur-2xl" />
          <div className="flex items-start gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black"
              style={{ background: "var(--color-accent)", color: "#0a0c10" }}
            >
              AI
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                Performance intelligence · LEAF read on your season
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg)]/90">
                {report.narrative || "Bookings will appear here as the season gets underway."}
              </p>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Bookings this season" value={report.totals.bookings.toLocaleString("en-US")} accent />
          <Kpi
            label="Pay-and-Train revenue"
            value={`${currency} ${report.totals.payAndTrainRevenue.toLocaleString("en-US")}`}
            sub={`${report.totals.distinctPayAndTrainCustomers} unique customers`}
          />
          <Kpi
            label="Visiting clubs"
            value={String(report.totals.externalClub)}
            sub={`${report.totals.distinctExternalClubs} different clubs`}
          />
          <Kpi
            label="Internal team sessions"
            value={String(report.totals.internal)}
            sub={`${report.topLines[0]?.utilization ? Math.round(report.topLines[0].utilization * 100) : 0}% peak line use`}
          />
        </div>

        {/* Charts — bookings flow + heatmap + customer leaderboards */}
        <UtilizationCharts report={report} currency={currency} />
      </div>
    </>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card relative p-4">
      {accent && (
        <span
          className="absolute inset-x-0 top-0 h-[2px] rounded-t-[14px]"
          style={{ background: "var(--color-accent)", opacity: 0.85 }}
        />
      )}
      <div className="kicker">{label}</div>
      <div className="num mt-1 text-2xl font-bold tracking-tight" style={accent ? { color: "var(--color-accent)" } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

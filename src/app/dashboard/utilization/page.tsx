import { PageHeader } from "@/components/PageHeader";
import { UtilizationCharts } from "@/components/UtilizationCharts";
import { getSession, requireAcademyId } from "@/lib/auth";
import { getActiveSeason } from "@/lib/season-server";
import { getUtilizationReport, getProSeasonRevenue } from "@/lib/utilization";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// LEAF OS Essential — Reports.
//
// Two stories on one page:
//   • Pay-and-Train customer flow — annual + seasonal, how revenue ticks up
//   • Line utilization — which slopes/lines/days/slots get used, by whom
//
// On tier="complete" academies we also surface a Pro-vs-Essential revenue
// comparison so Marius can see at a glance how the two product lines
// stack up against each other this season.
//
// The AI-style narrative on top is deterministic (no LLM call). It reads
// the same aggregates the charts render and writes 3-5 sentences in plain
// English. That keeps it fast, audit-safe, and offline-capable.
export default async function UtilizationPage() {
  const s = await getSession();
  const academyId = await requireAcademyId();
  const isAdmin = s?.isAdmin ?? false;
  const season = await getActiveSeason();
  const academy = await prisma.academy.findUnique({
    where: { id: academyId },
    select: { currency: true, name: true, tier: true },
  });
  const currency = academy?.currency ?? "EUR";
  const isComplete = academy?.tier === "complete";

  const [report, proRevenue] = await Promise.all([
    getUtilizationReport(academyId, season, currency),
    // Only pay the Postgres roundtrip for Pro revenue when the academy
    // actually has the Professional product line activated.
    isComplete ? getProSeasonRevenue(academyId, season) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Reports"
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

        {/* Pro vs Essential revenue comparison — only when the academy
            bought both product lines (tier=complete). Side-by-side bars
            answer "which side of LEAF made you more money this season?" */}
        {isComplete && proRevenue && (
          <RevenueComparison
            currency={currency}
            season={season}
            proCollected={proRevenue.collected}
            essentialRevenue={report.totals.payAndTrainRevenue}
            essentialBookings={report.totals.payAndTrain}
          />
        )}

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

function RevenueComparison({
  currency,
  season,
  proCollected,
  essentialRevenue,
  essentialBookings,
}: {
  currency: string;
  season: string;
  proCollected: number;
  essentialRevenue: number;
  essentialBookings: number;
}) {
  const total = proCollected + essentialRevenue;
  const proShare = total > 0 ? proCollected / total : 0;
  const essShare = total > 0 ? essentialRevenue / total : 0;
  const fmt = (n: number) => `${currency} ${n.toLocaleString("en-US")}`;
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Revenue · Professional vs Essential</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
            Season {season} · how the two LEAF product lines compare side-by-side.
          </p>
        </div>
        <div className="num text-right text-sm">
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Total</div>
          <div className="font-bold" style={{ color: "var(--color-accent)" }}>{fmt(total)}</div>
        </div>
      </div>

      {/* Side-by-side bars */}
      <div className="mt-4 space-y-3">
        <ComparisonRow
          label="LEAF OS Professional"
          sub="Athletes · packages · season payments"
          value={fmt(proCollected)}
          share={proShare}
          colorFrom="#7cff6b"
          colorTo="#7cff6b80"
        />
        <ComparisonRow
          label="LEAF OS Essential"
          sub={`Pay-and-Train · ${essentialBookings} sold session${essentialBookings === 1 ? "" : "s"}`}
          value={fmt(essentialRevenue)}
          share={essShare}
          colorFrom="#38bdf8"
          colorTo="#38bdf880"
        />
      </div>

      {total > 0 && (
        <p className="mt-4 text-xs text-[var(--color-muted)]">
          {proShare >= essShare
            ? `Professional drives ${Math.round(proShare * 100)}% of revenue — the core season business.`
            : `Essential drives ${Math.round(essShare * 100)}% of revenue — Pay-and-Train is your bigger line right now.`}
        </p>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  sub,
  value,
  share,
  colorFrom,
  colorTo,
}: {
  label: string;
  sub: string;
  value: string;
  share: number;
  colorFrom: string;
  colorTo: string;
}) {
  const widthPct = Math.max(2, Math.round(share * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <div>
          <span className="font-semibold">{label}</span>
          <span className="ml-2 text-[var(--color-muted)]">{sub}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="num text-sm font-bold">{value}</span>
          <span className="text-[10px] text-[var(--color-muted)]">{Math.round(share * 100)}%</span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${widthPct}%`,
            background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
          }}
        />
      </div>
    </div>
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

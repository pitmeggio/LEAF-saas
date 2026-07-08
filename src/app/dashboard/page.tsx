import Link from "next/link";
import {
  Users, ClipboardList, Banknote, Clock, Gauge, TrendingDown, TrendingUp,
  Swords, Trophy, Target, HeartPulse, UserCog, Sparkles, ArrowRight, CheckCircle2,
  Activity, Bell, Wallet,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, PercentBar, Dot } from "@/components/StatCard";
import { PulseGauge, type PulseStatus } from "@/components/PulseGauge";
import { getAcademy } from "@/lib/queries";
import { getDashboard, getTennisDashboardStats } from "@/lib/ops";
import { getSession } from "@/lib/auth";
import { CoachDashboard } from "@/components/CoachDashboard";
import { OfficeDashboard } from "@/components/OfficeDashboard";
import { fmtMoney, fmtDate } from "@/lib/domain";
import { getExpiryAlerts } from "@/lib/anagrafica/expiry";
import { DOC_TYPE_META, EXPIRY_COLOR } from "@/lib/anagrafica/anagraficaTypes";
import { getActiveSeason } from "@/lib/season-server";
import { getSportModuleForAcademy } from "@/lib/sports/registry";
import type { DashboardKpi } from "@/lib/sports/types";

export const dynamic = "force-dynamic";

const SEV_COLOR = { high: "#f87171", medium: "#f59e0b", low: "#8a93a6" } as const;

// One lucide glyph per KPI source — gives each stat card a quiet visual anchor
// so the grid reads at a glance instead of as a wall of numbers.
const KPI_ICON: Record<string, LucideIcon> = {
  totalAthletes: Users,
  activeApplications: ClipboardList,
  seasonRevenue: Banknote,
  pendingPayments: Clock,
  budgetUsage: Gauge,
  performanceAlerts: TrendingDown,
  matchesThisSeason: Swords,
  avgWinRate: Trophy,
  avgFisProgression: TrendingUp,
  avgFisPoints: Target,
  injuredCount: HeartPulse,
  activeCoachesCount: UserCog,
};

// Premium, focused Overview — 6 KPI cards + Today (AI) + Group distribution +
// Recent activity. Anything deeper lives in its own module (Finance, Reports…).
export default async function OverviewPage() {
  const session = await getSession();
  if (session?.isOffice) return <OfficeDashboard />;
  if (session && !session.isAdmin) return <CoachDashboard />;

  const season = await getActiveSeason();
  const [academy, d, expiryAlerts] = await Promise.all([
    getAcademy(),
    getDashboard({ season }),
    // Tessera FIT / iPin / typed-document deadlines — expired or within 30 days.
    session?.academyId ? getExpiryAlerts(session.academyId) : Promise.resolve([]),
  ]);
  const f = d.finance;
  const perfAlertCount = d.alerts.filter((a) => a.type === "declining_trend").length;

  // Academy pulse — four glanceable health signals, each a real ratio. The
  // ring always fills toward "good" (fuller = healthier) and the colour
  // reinforces the status, so the row reads at a glance.
  const totalCap = d.groupDistribution.reduce((a, g) => a + g.capacity, 0);
  const inGroups = d.groupDistribution.reduce((a, g) => a + g.count, 0);
  const occupancy = totalCap ? Math.round((inGroups / totalCap) * 100) : 0;
  const rosterStatus: PulseStatus = occupancy > 105 ? "bad" : occupancy >= 60 ? "good" : "watch";

  const headroom = Math.max(0, 100 - d.budgetPctUsed);
  const budgetStatus: PulseStatus = d.budgetPctUsed > 100 ? "bad" : d.budgetPctUsed > 85 ? "watch" : "good";

  const invoiced = f.collected + f.outstandingTotal;
  const collectRate = invoiced > 0 ? Math.round((f.collected / invoiced) * 100) : 100;
  const collectStatus: PulseStatus = collectRate >= 80 ? "good" : collectRate >= 40 ? "watch" : "bad";

  const alertCount = d.alerts.length;
  const calm = alertCount === 0 ? 100 : Math.max(15, 100 - alertCount * 18);
  const attnStatus: PulseStatus = alertCount === 0 ? "good" : alertCount <= 2 ? "watch" : "bad";

  // Sport-aware KPI grid — the active sport module decides what to display.
  // Only fetch sport-specific aggregates (tennis) when the module asks for them.
  const sport = getSportModuleForAcademy(academy);
  const needsTennisStats = sport.dashboardKpis.some((k) =>
    k.source === "matchesThisSeason" || k.source === "avgWinRate"
  );
  const tennisStats = needsTennisStats ? await getTennisDashboardStats({ season }) : null;

  return (
    <>
      <PageHeader
        title="Panoramica"
        subtitle={`${academy?.name ?? ""}${academy?.location ? " · " + academy.location : ""} · Stagione ${season}`}
        right={
          <Link href="/dashboard/alerts" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)]">
            {d.alerts.length} avvis{d.alerts.length === 1 ? "o" : "i"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      />

      <div className="space-y-6 p-8">
        {/* Academy pulse — a signature glance: four live health rings. */}
        <div className="card p-6">
          <div className="mb-5 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />
            <h2 className="text-sm font-semibold">Stato academy</h2>
            <span className="text-[11px] text-[var(--color-muted)]">dati in tempo reale · {season}</span>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <PulseGauge
              icon={Users}
              value={Math.min(100, occupancy)}
              status={rosterStatus}
              center={`${occupancy}%`}
              label="Rosa"
              sub={`${inGroups}/${totalCap} posti occupati`}
            />
            <PulseGauge
              icon={Wallet}
              value={headroom}
              status={budgetStatus}
              center={`${headroom}%`}
              label="Budget residuo"
              sub={`${d.budgetPctUsed}% usato`}
            />
            <PulseGauge
              icon={Banknote}
              value={collectRate}
              status={collectStatus}
              center={`${collectRate}%`}
              label="Incassato"
              sub={invoiced > 0 ? "del fatturato" : "tutto saldato"}
            />
            <PulseGauge
              icon={Bell}
              value={calm}
              status={attnStatus}
              center={String(alertCount)}
              label="Da gestire"
              sub={alertCount === 0 ? "tutto ok" : `item${alertCount === 1 ? "" : "s"} need you`}
            />
          </div>
        </div>

        {/* Today — AI triage. Hidden when nothing needs you. */}
        {d.alerts.length > 0 ? (
          <div className="card p-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>
                <Sparkles className="h-3 w-3" aria-hidden />AI
              </span>
              <h2 className="text-sm font-semibold">Oggi</h2>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              <span className="font-semibold text-[var(--color-fg)]">{d.alerts.length} cos{d.alerts.length === 1 ? "a" : "e"} da gestire</span> — tutto il resto è gestito in automatico su {d.activeAthletes} atleti.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {d.alerts.slice(0, 4).map((a) => (
                <Link key={a.id} href={a.href ?? "#"} className="group flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 hover:border-[var(--color-accent)]">
                  <Dot color={SEV_COLOR[a.severity]} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-[var(--color-muted)]">{a.detail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-muted)] group-hover:text-[var(--color-accent)]" aria-hidden />
                </Link>
              ))}
            </div>
            {d.alerts.length > 4 && (
              <Link href="/dashboard/alerts" className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline">Vedi tutti i {d.alerts.length}<ArrowRight className="h-3 w-3" aria-hidden /></Link>
            )}
          </div>
        ) : (
          <div className="card flex items-center gap-3 p-4 text-sm">
            <span className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>
              <Sparkles className="h-3 w-3" aria-hidden />AI
            </span>
            <span className="flex items-center gap-1.5 text-[var(--color-fg)]/85"><CheckCircle2 className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />Sei in pari. LEAF segue in automatico {d.activeAthletes} athletes.</span>
          </div>
        )}

        {/* Scadenze tessere & documenti — tessera FIT / iPin alert (Max spec).
            Hidden when nothing is expired or expiring within 30 days. */}
        {expiryAlerts.length > 0 && (
          <div className="card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#f5a623]" aria-hidden />
              <h2 className="text-sm font-semibold">Scadenze tessere &amp; documenti</h2>
              <span className="text-[11px] text-[var(--color-muted)]">{expiryAlerts.length} da rinnovare</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {expiryAlerts.slice(0, 6).map((a, i) => {
                const meta = DOC_TYPE_META[a.kind];
                const color = EXPIRY_COLOR[a.status];
                return (
                  <div key={`${a.athleteId}-${a.kind}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate"><span aria-hidden>{meta.emoji}</span> <span className="font-medium">{a.athleteName}</span><span className="text-[var(--color-muted)]"> · {a.label}</span></span>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${color}22`, color }}>
                      {a.status === "expired" ? `Scaduta · ${fmtDate(a.expiresAt)}` : `Scade tra ${a.daysLeft}g`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sport-aware KPI grid — the active sport module decides which cards
            land here. Ski leads with Performance alerts + Budget usage;
            Tennis swaps those out for Matches this season + Avg win rate. */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {sport.dashboardKpis.map((kpi) => {
            const props = kpiCardProps(kpi, {
              season,
              activeAthletes: d.activeAthletes,
              pipelineCount: d.pipelineCount,
              accepted: d.accepted,
              budgetPctUsed: d.budgetPctUsed,
              usedBudget: d.usedBudget,
              totalBudget: d.totalBudget,
              perfAlertCount,
              currency: f.currency,
              collected: f.collected,
              outstandingTotal: f.outstandingTotal,
              unpaidAthletes: f.unpaidAthletes,
              tennisStats,
              avgFisPoints: d.avgFisPoints,
              injuredCount: d.injuredCount,
              activeCoachesCount: d.activeCoachesCount,
            });
            return <StatCard key={kpi.key} {...props} icon={KPI_ICON[kpi.source]} />;
          })}
        </div>

        {/* Two-column: Group distribution + Recent activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Distribuzione gruppi</h2>
              <Link href="/dashboard/groups" className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline">Tutti i gruppi<ArrowRight className="h-3 w-3" aria-hidden /></Link>
            </div>
            {d.groupDistribution.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">Ancora nessun gruppo.</p>
            ) : (
              <div className="space-y-3">
                {d.groupDistribution.map((g) => (
                  <div key={g.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{g.name}</span>
                      <span className="num text-[var(--color-muted)]">{g.count}/{g.capacity} · {g.pct}%</span>
                    </div>
                    <PercentBar value={g.pct} color={g.pct > 100 ? "#f87171" : g.pct > 85 ? "#f59e0b" : "var(--color-accent)"} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Attività recente</h2>
              <Link href="/dashboard/applications" className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline">Tutte le iscrizioni<ArrowRight className="h-3 w-3" aria-hidden /></Link>
            </div>
            {d.recentActivity.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">Ancora nessuna attività.</p>
            ) : (
              <div className="space-y-2">
                {d.recentActivity.map((a) => (
                  <Link key={a.id} href={a.href} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm hover:border-[var(--color-accent)]">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.title}</div>
                      <div className="truncate text-[11px] capitalize text-[var(--color-muted)]">{a.detail}</div>
                    </div>
                    <div className="shrink-0 text-[10px] text-[var(--color-muted)]">{new Date(a.when).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Maps a sport-module KPI (declared as a `source` key) to the props the
// StatCard component renders. New KPI sources land here — keep the switch
// exhaustive so new sports drop in without surprises.
type KpiData = {
  season: string;
  activeAthletes: number;
  pipelineCount: number;
  accepted: number;
  budgetPctUsed: number;
  usedBudget: number;
  totalBudget: number;
  perfAlertCount: number;
  currency: string;
  collected: number;
  outstandingTotal: number;
  unpaidAthletes: number;
  tennisStats: { matchesThisSeason: number; avgWinRate: number } | null;
  avgFisPoints: number | null;
  injuredCount: number;
  activeCoachesCount: number;
};

function kpiCardProps(kpi: DashboardKpi, d: KpiData) {
  const base = { label: kpi.label, hint: kpi.hint } as { label: string; value: string; hint?: string; accent?: boolean; danger?: boolean; href?: string };
  switch (kpi.source) {
    case "totalAthletes":
      return { ...base, value: String(d.activeAthletes), hint: kpi.hint ?? "atleti iscritti", accent: true, href: "/dashboard/athletes" };
    case "activeApplications":
      return { ...base, value: String(d.pipelineCount), hint: kpi.hint ?? `${d.accepted} accettati questa stagione`, href: "/dashboard/applications" };
    case "seasonRevenue":
      return { ...base, value: fmtMoney(d.collected, d.currency), hint: kpi.hint ?? `incassato · ${d.season}`, accent: !kpi.hint, href: "/dashboard/payments" };
    case "pendingPayments":
      return { ...base, value: fmtMoney(d.outstandingTotal, d.currency), hint: kpi.hint ?? `${d.unpaidAthletes} atleti da sollecitare`, danger: d.outstandingTotal > 0, href: "/dashboard/payments" };
    case "budgetUsage":
      return { ...base, value: `${d.budgetPctUsed}%`, hint: kpi.hint ?? `${fmtMoney(d.usedBudget, d.currency)} of ${fmtMoney(d.totalBudget, d.currency)}`, danger: d.budgetPctUsed > 100, href: "/dashboard/budgets" };
    case "performanceAlerts":
      return { ...base, value: String(d.perfAlertCount), hint: kpi.hint ?? "atleti in calo", danger: d.perfAlertCount > 0, href: "/dashboard/alerts" };
    case "matchesThisSeason":
      return { ...base, value: String(d.tennisStats?.matchesThisSeason ?? 0), hint: kpi.hint ?? `registrate · ${d.season}`, href: "/dashboard/athletes" };
    case "avgWinRate":
      return { ...base, value: `${d.tennisStats?.avgWinRate ?? 0}%`, hint: kpi.hint ?? "su tutte le partite registrate", accent: (d.tennisStats?.avgWinRate ?? 0) >= 50, href: "/dashboard/athletes" };
    case "avgFisProgression":
      // Reserved for a future ski-specific aggregate; falls back gracefully.
      return { ...base, value: "—", hint: kpi.hint ?? "season progression (coming)" };
    case "avgFisPoints":
      return {
        ...base,
        value: d.avgFisPoints != null ? String(d.avgFisPoints) : "—",
        hint: kpi.hint ?? "across the active roster",
        href: "/dashboard/athletes",
      };
    case "injuredCount":
      return {
        ...base,
        value: String(d.injuredCount),
        hint: kpi.hint ?? "currently flagged",
        danger: d.injuredCount > 0,
        href: "/dashboard/athletes",
      };
    case "activeCoachesCount":
      return {
        ...base,
        value: String(d.activeCoachesCount),
        hint: kpi.hint ?? "on the team",
        href: "/dashboard/coaches",
      };
    default: {
      // Exhaustiveness guard — surfaced if a sport adds a new source the
      // page hasn't taught itself to render yet.
      const _exhaustive: never = kpi.source;
      return { ...base, value: "—" };
    }
  }
}

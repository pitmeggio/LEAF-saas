import { PageHeader } from "@/components/PageHeader";
import { PercentBar } from "@/components/StatCard";
import { getActiveAthletes, getFinance, getGroupsWithStats, getDocumentsData, getSeasonReport, type SeasonReport } from "@/lib/ops";
import { getAcademy } from "@/lib/queries";
import { requireAdmin } from "@/lib/auth";
import { fmtMoney, fmtDate, PERF_COLOR } from "@/lib/domain";
import { getActiveSeason } from "@/lib/season-server";
import { previousSeason, trailingSeasons } from "@/lib/season";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireAdmin();
  const active = await getActiveSeason();
  const prior = previousSeason(active);
  const trendSeasons = trailingSeasons(active, 4);

  const [academy, members, finance, groups, docs, current, previous, trend] = await Promise.all([
    getAcademy(),
    getActiveAthletes(),
    getFinance(),
    getGroupsWithStats(),
    getDocumentsData(),
    getSeasonReport(active),
    getSeasonReport(prior),
    Promise.all(trendSeasons.map((s) => getSeasonReport(s))),
  ]);

  const perf = {
    improving: members.filter((m) => m.perf === "improving").length,
    stable: members.filter((m) => m.perf === "stable").length,
    declining: members.filter((m) => m.perf === "declining").length,
  };
  const totalCap = groups.reduce((s, g) => s + g.capacity, 0);
  const inGroups = groups.reduce((s, g) => s + g.count, 0);
  const docTotal = docs.docs.length || 1;
  const compliant = docs.docs.filter((d) => d.status === "verified" || d.status === "uploaded").length;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Season ${active} vs ${prior} · auto-generated ${fmtDate(new Date())}`}
      />
      <div className="space-y-6 p-8">
        {/* Year-over-year comparison — the report's headline */}
        <Section title={`Season comparison · ${active} vs ${prior}`} subtitle="growth across the metrics that move the academy">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompareCard label="New athletes" curr={current.newAthletes} prev={previous.newAthletes} />
            <CompareCard label="Applications" curr={current.newApplications} prev={previous.newApplications} />
            <CompareCard label="Accepted" curr={current.acceptedApplications} prev={previous.acceptedApplications} />
            <CompareCard
              label="Revenue collected"
              curr={current.revenueCollected}
              prev={previous.revenueCollected}
              fmt={(n) => fmtMoney(n, current.currency)}
            />
            <CompareCard
              label="Expenses approved"
              curr={current.expensesApproved}
              prev={previous.expensesApproved}
              fmt={(n) => fmtMoney(n, current.currency)}
              lowerIsBetter
            />
            <CompareCard
              label="Net result"
              curr={current.netResult}
              prev={previous.netResult}
              fmt={(n) => fmtMoney(n, current.currency)}
            />
          </div>
        </Section>

        {/* Trend strip — 4-season sparkbar across the headline metrics */}
        <Section title="4-season trend" subtitle="how this academy has grown over the last four seasons">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <TrendBars title="New athletes" series={trend} pick={(r) => r.newAthletes} />
            <TrendBars title="Applications" series={trend} pick={(r) => r.newApplications} />
            <TrendBars
              title={`Revenue (${current.currency})`}
              series={trend}
              pick={(r) => r.revenueCollected}
              fmt={(n) => fmtMoney(n, current.currency)}
            />
            <TrendBars
              title={`Net result (${current.currency})`}
              series={trend}
              pick={(r) => r.netResult}
              fmt={(n) => fmtMoney(n, current.currency)}
              allowNegative
            />
          </div>
        </Section>

        {/* Quality metrics row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Section title="Payment completion" subtitle={`collected vs due this season`}>
            <BigStat value={`${current.collectionRate}%`} hint={`${fmtMoney(current.revenueCollected, current.currency)} of ${fmtMoney(current.revenueDue, current.currency)}`} />
            <PercentBar value={current.collectionRate} color={current.collectionRate < 70 ? "#f59e0b" : "var(--color-accent)"} />
            <div className="mt-2 text-xs text-[var(--color-muted)]">Prior season: {previous.collectionRate}%</div>
          </Section>

          <Section title="Athlete retention" subtitle="kept this season from the prior roster">
            <BigStat value={`${current.retentionRate}%`} hint={`${current.retainedFromPrior} of ${current.priorSeasonAthletes} athletes returning`} />
            <PercentBar value={current.retentionRate} color={current.retentionRate < 60 ? "#f87171" : current.retentionRate < 80 ? "#f59e0b" : "var(--color-accent)"} />
            <div className="mt-2 text-xs text-[var(--color-muted)]">No baseline if the prior season has no enrolments.</div>
          </Section>

          {/* Performance progression card removed by request — Reports is a
              finance read-out, not a coaching surface. Squad trend lives on
              the Athlete Canvas / Athletes pages where coaches actually
              read it. */}
        </div>

        {/* Package popularity year-over-year */}
        <Section title="Package popularity" subtitle="how athletes chose their plan this season vs last">
          <div className="grid gap-6 md:grid-cols-2">
            <PackageList title={`Season ${active}`} packages={current.packageMix} />
            <PackageList title={`Season ${prior}`} packages={previous.packageMix} />
          </div>
        </Section>

        {/* Current-state operations panel */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Capacity & compliance" subtitle="current state — independent of season">
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-xs"><span className="text-[var(--color-muted)]">Group occupancy</span><span className="num">{inGroups}/{totalCap}</span></div>
              <PercentBar value={totalCap ? (inGroups / totalCap) * 100 : 0} />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs"><span className="text-[var(--color-muted)]">Document compliance</span><span className="num">{compliant}/{docs.docs.length}</span></div>
              <PercentBar value={(compliant / docTotal) * 100} color={docs.missing.length ? "#f59e0b" : "var(--color-accent)"} />
            </div>
            <div className="mt-3 text-xs text-[var(--color-muted)]">{docs.missing.length} missing · {docs.expired.length} expired</div>
          </Section>

          <Section title="Finance snapshot" subtitle="current state · base currency only">
            <Line label="Total contract value" hint="all active deals" value={fmtMoney(finance.totalContract, finance.currency)} />
            <Line label="Monthly recurring" hint="avg/mo · last 3 months" value={fmtMoney(finance.monthlyRecurring, finance.currency)} />
            <Line label="Overdue" hint="past due date" value={fmtMoney(finance.overdueTotal, finance.currency)} danger />
            <Line label="Active subscriptions" hint="athletes on a package" value={String(finance.activeSubscriptions)} />
          </Section>
        </div>

        {/* Operational team detail */}
        <Section title="Team budget allocation" subtitle="current snapshot · margin = revenue − coach cost, per group">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <th className="py-2 font-medium">Team</th>
                  <th className="py-2 font-medium">Athletes</th>
                  <th className="py-2 font-medium">Revenue</th>
                  <th className="py-2 font-medium">Coach cost</th>
                  <th className="py-2 font-medium">Budget</th>
                  <th className="py-2 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-t border-[var(--color-border)]">
                    <td className="py-2">{g.name}{g.overCapacity && <span className="ml-2 text-[10px] font-semibold text-[#f87171]">OVER</span>}</td>
                    <td className="num py-2">{g.count}/{g.capacity}</td>
                    <td className="num py-2">{fmtMoney(g.revenue, finance.currency)}</td>
                    <td className="num py-2 text-[var(--color-muted)]">{fmtMoney(g.coachCost, finance.currency)}</td>
                    <td className="num py-2 text-[var(--color-muted)]">{fmtMoney(g.budget, finance.currency)}</td>
                    <td className="num py-2 font-semibold" style={{ color: g.marginPositive ? "var(--color-accent)" : "#f87171" }}>{fmtMoney(g.margin, finance.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {academy && (
          <p className="text-center text-[11px] text-[var(--color-muted)]">
            {academy.name} · {academy.location ?? "—"} · Season metrics computed from operational data, no manual entry.
          </p>
        )}
      </div>
    </>
  );
}

// ── Building blocks ────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="mb-4 mt-0.5 text-xs text-[var(--color-muted)]">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Line({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <div className="flex items-start justify-between py-1.5">
      <span className="text-[var(--color-muted)]">
        {label}
        {hint && <span className="block text-[11px] opacity-70">{hint}</span>}
      </span>
      <span className="num font-semibold" style={danger ? { color: "#f87171" } : undefined}>{value}</span>
    </div>
  );
}

function Bars({ items, total }: { items: { label: string; value: number; color: string }[]; total: number }) {
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex justify-between text-xs"><span>{it.label}</span><span className="num">{it.value}</span></div>
          <PercentBar value={(it.value / total) * 100} color={it.color} />
        </div>
      ))}
    </div>
  );
}

function BigStat({ value, hint }: { value: string; hint?: string }) {
  return (
    <div className="mb-3">
      <div className="num text-2xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}

function CompareCard({
  label,
  curr,
  prev,
  fmt,
  lowerIsBetter,
}: {
  label: string;
  curr: number;
  prev: number;
  fmt?: (n: number) => string;
  lowerIsBetter?: boolean;
}) {
  const format = fmt ?? ((n: number) => String(n));
  // delta: meaningful when prev is non-zero. When prev=0 we show the raw move.
  let pct: number | null = null;
  if (prev !== 0) pct = ((curr - prev) / Math.abs(prev)) * 100;
  const rawGrew = curr > prev;
  const good = lowerIsBetter ? !rawGrew : rawGrew;
  const color = curr === prev ? "var(--color-muted)" : good ? "var(--color-accent)" : "#f87171";
  const arrow = curr === prev ? "·" : rawGrew ? "▲" : "▼";
  const deltaText = pct === null
    ? curr === prev ? "no change" : `${rawGrew ? "+" : ""}${format(curr - prev)} (new)`
    : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <div className="num text-xl font-bold">{format(curr)}</div>
        <div className="num text-xs font-semibold" style={{ color }}>
          {arrow} {deltaText}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-[var(--color-muted)]">prior: <span className="num">{format(prev)}</span></div>
    </div>
  );
}

function TrendBars({
  title,
  series,
  pick,
  fmt,
  allowNegative,
}: {
  title: string;
  series: SeasonReport[];
  pick: (r: SeasonReport) => number;
  fmt?: (n: number) => string;
  allowNegative?: boolean;
}) {
  const values = series.map(pick);
  const format = fmt ?? ((n: number) => String(n));
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  return (
    <div>
      <div className="mb-3 text-xs font-medium text-[var(--color-muted)]">{title}</div>
      <div className="flex items-end gap-3" style={{ height: 96 }}>
        {series.map((r, i) => {
          const v = values[i];
          const pct = max === 0 ? 0 : (Math.abs(v) / max) * 100;
          const negative = allowNegative && v < 0;
          return (
            <div key={r.season} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="num text-[10px] font-semibold">{format(v)}</div>
              <div className="flex w-full items-end" style={{ height: 56 }}>
                <div
                  className="w-full rounded-md transition-all"
                  style={{
                    height: `${Math.max(2, pct)}%`,
                    background: negative ? "#f87171" : "var(--color-accent)",
                    opacity: i === series.length - 1 ? 1 : 0.55,
                  }}
                />
              </div>
              <div className="text-[10px] text-[var(--color-muted)]">{r.season}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PackageList({ title, packages }: { title: string; packages: { id: string; name: string; count: number }[] }) {
  if (packages.length === 0) {
    return (
      <div>
        <div className="mb-2 text-xs font-medium text-[var(--color-muted)]">{title}</div>
        <p className="text-sm text-[var(--color-muted)]">No package selections in this season.</p>
      </div>
    );
  }
  const max = Math.max(1, ...packages.map((p) => p.count));
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-[var(--color-muted)]">{title}</div>
      <div className="space-y-2">
        {packages.map((p) => (
          <div key={p.id}>
            <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{p.name}</span><span className="num text-[var(--color-muted)]">{p.count}</span></div>
            <PercentBar value={(p.count / max) * 100} />
          </div>
        ))}
      </div>
    </div>
  );
}

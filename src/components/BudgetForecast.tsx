import Link from "next/link";
import { fmtMoney } from "@/lib/domain";
import type { GroupForecast } from "@/lib/budgetForecast";

// Forecast surface for the Budgets page. Two surfaces:
//
//   • <BudgetForecastTotals> — academy-wide rollup card (3 numbers + sanity hint).
//     Goes at the top of the page, next to the actual-spend totals.
//
//   • <BudgetForecastCard>   — per-group breakdown (line items + total + net).
//     Sits inside each group card so admins read "what is this team
//     actually going to cost" right where they edit the budget.
//
// Both components are server-renderable (no client interactivity), so the
// math is computed on the server and served as pure HTML.

export function BudgetForecastTotals({
  totalCost,
  totalIncome,
  totalNet,
  totalAthletes,
  groupCount,
  currency,
  configured,
}: {
  totalCost: number;
  totalIncome: number;
  totalNet: number;
  totalAthletes: number;
  groupCount: number;
  currency: string;
  configured: boolean;
}) {
  // No benchmarks yet — point the admin at the settings card instead of a row of zeros.
  if (!configured) {
    return (
      <div className="card flex items-start gap-3 p-5">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
        <div>
          <div className="text-sm font-semibold">Forecast not configured yet</div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Set your academy&apos;s cost benchmarks once and LEAF projects each team&apos;s cost from the roster, the season calendar and the coach assignments — no Excel needed.
          </p>
          <Link href="#benchmarks" className="mt-2 inline-block text-[11px] text-[var(--color-accent)] hover:underline">
            Set benchmarks ↓
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
        <h2 className="text-sm font-semibold">Season forecast</h2>
        <span className="ml-auto text-[10px] text-[var(--color-muted)]">{groupCount} team{groupCount === 1 ? "" : "s"} · {totalAthletes} athletes</span>
      </div>
      <p className="text-[11px] text-[var(--color-muted)]">
        Where the season will land, computed from the athletes enrolled, the season calendar, the coaches you assigned and your cost rates. Recalculated every time you load this page.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat
          label="Total season cost"
          value={fmtMoney(totalCost, currency)}
          sub="coach + travel + housing + ops"
        />
        <Stat
          label="Income from athletes"
          value={fmtMoney(totalIncome, currency)}
          accent
          sub="sum of package prices"
        />
        <Stat
          label="Net at season end"
          value={fmtMoney(totalNet, currency)}
          color={totalNet >= 0 ? "var(--color-accent)" : "#f87171"}
          sub={totalNet >= 0 ? "income covers costs" : "shortfall to plug"}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, accent, color, sub }: { label: string; value: string; accent?: boolean; color?: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="num mt-1 text-lg font-semibold" style={color ? { color } : accent ? { color: "var(--color-accent)" } : undefined}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

// Per-group breakdown. Each line shows the formula in human English so a coach
// can sanity-check the number ("8 ath × 90 nights × 1000 = 720k") rather than
// trust a black box. Lines come pre-sorted by category by the engine.
export function BudgetForecastCard({
  forecast,
  currency,
}: {
  forecast: GroupForecast;
  currency: string;
}) {
  if (forecast.lines.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
        Forecast pending — add athletes / events or set benchmarks to see a projection.
      </div>
    );
  }

  const byCat = new Map<string, typeof forecast.lines>();
  for (const l of forecast.lines) {
    const arr = byCat.get(l.category) ?? [];
    arr.push(l);
    byCat.set(l.category, arr);
  }
  const CAT_LABEL: Record<string, string> = {
    staff: "Staff",
    lodging: "Lodging",
    travel: "Travel & on-snow",
    ops: "Per-athlete",
    overhead: "Academy overhead (share)",
  };
  const CAT_ORDER = ["staff", "lodging", "travel", "ops", "overhead"];

  return (
    <div className="text-sm">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Season forecast — what this team will cost</div>
        <span className="text-[10px] text-[var(--color-muted)]">{forecast.athletesCount} athlete{forecast.athletesCount === 1 ? "" : "s"}</span>
      </div>
      <dl className="space-y-2">
        {CAT_ORDER.filter((c) => byCat.has(c)).map((c) => (
          <div key={c}>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{CAT_LABEL[c]}</div>
            {byCat.get(c)!.map((l) => (
              <div key={l.key} className="flex items-baseline justify-between gap-3 py-0.5">
                <div className="min-w-0">
                  <div className="truncate text-xs">{l.label}</div>
                  <div className="truncate text-[10px] text-[var(--color-muted)]">{l.formula}</div>
                </div>
                <div className="num shrink-0 text-xs">{fmtMoney(l.amount, currency)}</div>
              </div>
            ))}
          </div>
        ))}
      </dl>
      <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
        <dt className="text-xs font-medium">Total season cost</dt>
        <dd className="num text-sm font-semibold">{fmtMoney(forecast.totalCost, currency)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt className="text-xs">Income from athletes</dt>
        <dd className="num text-xs">{fmtMoney(forecast.forecastIncome, currency)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt className="text-xs font-medium">Net at season end</dt>
        <dd className="num text-sm font-semibold" style={{ color: forecast.forecastNet >= 0 ? "var(--color-accent)" : "#f87171" }}>
          {fmtMoney(forecast.forecastNet, currency)}
        </dd>
      </div>
    </div>
  );
}

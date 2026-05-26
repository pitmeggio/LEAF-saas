"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertBudgetBenchmarks } from "@/app/budget-benchmarks-actions";
import type { BudgetBenchmarks } from "@/lib/budgetForecast";

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-xs text-[var(--color-muted)]";

// One-time setup form: per-academy cost benchmarks the forecast engine
// multiplies by quantities derived from the roster / calendar. Long form
// by design — 17 numbers — but it's a "set once" surface (admin tweaks
// rates a couple times a year). Grouped into Lodging / Travel / Staff /
// Overhead / Fallback so it's not just a wall of inputs.
//
// Saving recomputes the forecast on every Budgets page render — no async
// background refresh needed.
export function BudgetBenchmarksForm({
  initial,
  currency,
}: {
  initial: BudgetBenchmarks | null;
  currency: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const base: BudgetBenchmarks = initial ?? {
    pricePerNight: 0,
    liftPassPerDay: 0,
    mealsPerDay: 0,
    fuelPerTravelDay: 0,
    vanCostAnnual: 0,
    housingMonthly: 0,
    housingMonthsPerSeason: 8,
    clothingPerAthlete: 0,
    headCoachMonthlyRate: 0,
    headCoachMonthsPerSeason: 12,
    assistantCoachMonthlyRate: 0,
    assistantCoachMonthsPerSeason: 8,
    miscAnnual: 0,
    sportOpsAnnual: 0,
    defaultTravelDaysPerSeason: 0,
    defaultRaceDaysPerSeason: 0,
    defaultNightsPerSeason: 0,
  };
  const [f, set] = useState<BudgetBenchmarks>(base);
  const upd = (k: keyof BudgetBenchmarks, v: string) =>
    set((s) => ({ ...s, [k]: Number(v) || 0 }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await upsertBudgetBenchmarks(f);
      if (r.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  };

  // A compact numeric field with currency / unit suffix label. We pre-fill
  // with the current value (or 0) so admins see what's stored without
  // hunting for placeholders.
  const Num = ({
    k,
    label,
    unit,
    hint,
  }: { k: keyof BudgetBenchmarks; label: string; unit?: string; hint?: string }) => (
    <div>
      <label className={lbl}>
        {label} {unit ? <span className="text-[10px] text-[var(--color-muted)]">· {unit}</span> : null}
      </label>
      <input
        type="number"
        min={0}
        className={inp}
        value={f[k]}
        onChange={(e) => upd(k, e.target.value)}
      />
      {hint && <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">{hint}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Lodging</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Num k="pricePerNight" label="Hotel per night" unit={`${currency} / athlete / night`} />
          <Num k="housingMonthly" label="Base-camp apartment" unit={`${currency} / athlete / month`} />
          <Num k="housingMonthsPerSeason" label="Apartment months" unit="months / season" hint="How long the apartment runs (0–12)" />
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Travel & on-snow</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Num k="liftPassPerDay" label="Lift pass" unit={`${currency} / athlete / day`} />
          <Num k="mealsPerDay" label="Meals on the road" unit={`${currency} / athlete / day`} />
          <Num k="fuelPerTravelDay" label="Fuel" unit={`${currency} / van / day`} />
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Staff rates</div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Num k="headCoachMonthlyRate" label="Head coach" unit={`${currency} / month`} />
          <Num k="headCoachMonthsPerSeason" label="Head coach months" unit="months / season" />
          <Num k="assistantCoachMonthlyRate" label="Assistant coach" unit={`${currency} / month`} />
          <Num k="assistantCoachMonthsPerSeason" label="Assistant months" unit="months / season" />
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Per-athlete kit</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Num k="clothingPerAthlete" label="Team kit" unit={`${currency} / athlete / season`} />
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Academy-wide overhead</div>
        <p className="mb-2 text-[10px] text-[var(--color-muted)]">Allocated to each group in proportion to its share of athletes.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Num k="vanCostAnnual" label="Vehicle costs" unit={`${currency} / year`} hint="Insurance + depreciation + service" />
          <Num k="sportOpsAnnual" label="Sport ops" unit={`${currency} / year`} hint="Race entries, federation fees, gear" />
          <Num k="miscAnnual" label="Misc" unit={`${currency} / year`} hint="Admin, comms, catch-all" />
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Season fallback</div>
        <p className="mb-2 text-[10px] text-[var(--color-muted)]">Used when the season calendar is still empty so the forecast works on day one. Once events are added the engine uses real calendar days.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Num k="defaultTravelDaysPerSeason" label="Travel days" unit="days / season" />
          <Num k="defaultRaceDaysPerSeason" label="Race / training days on snow" unit="days / season" />
          <Num k="defaultNightsPerSeason" label="Nights on the road" unit="nights / season" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <div className="text-xs">
          {error ? <span className="text-[#f87171]">{error}</span> : saved ? <span className="text-[var(--color-accent)]">✓ Saved. Forecast updated.</span> : <span className="text-[var(--color-muted)]">All amounts in {currency}.</span>}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-[#7CFF6B40] bg-[#7cff6b12] px-4 py-2 text-sm font-medium text-[var(--color-accent)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save benchmarks"}
        </button>
      </div>
    </form>
  );
}

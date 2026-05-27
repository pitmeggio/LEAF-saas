import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ImportForm } from "@/components/ImportForm";
import { BulkImportForm } from "@/components/BulkImportForm";
import { DEMO_FIS_CODES } from "@/lib/fis/simulatedProvider";
import { getFisProviderMode } from "@/lib/fis/import";

export const dynamic = "force-dynamic";

// Mode-aware badge: tells the user instantly whether they're looking at real
// FIS data or curated demo records. Same badge component drives the "right"
// slot of the page header AND the bigger callout under the form.
function ProviderBadge({ mode }: { mode: "live" | "simulated" | "auto" }) {
  if (mode === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7CFF6B40] bg-[#7cff6b12] px-2.5 py-1 text-[11px] font-medium text-[var(--color-accent)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
        Live FIS · fis-ski.com
      </span>
    );
  }
  if (mode === "simulated") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b40] bg-[#f59e0b12] px-2.5 py-1 text-[11px] font-medium text-[#f59e0b]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
        Demo data · simulated
      </span>
    );
  }
  // auto: warn that misses get faked silently
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b40] bg-[#f59e0b12] px-2.5 py-1 text-[11px] font-medium text-[#f59e0b]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
      Auto · falls back to demo if not found
    </span>
  );
}

export default function ImportPage() {
  const mode = getFisProviderMode();
  return (
    <>
      <PageHeader
        title="Import from FIS"
        subtitle="Enter a FIS code to auto-build the athlete's verified sports CV."
        right={
          <div className="flex items-center gap-3">
            <ProviderBadge mode={mode} />
            <Link href="/dashboard/athletes" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">
              ← Back to athletes
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 p-8 lg:grid-cols-2">
        <ImportForm demoCodes={DEMO_FIS_CODES} />

        <div className="card p-6">
          <h3 className="text-sm font-semibold">What gets imported</h3>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
            <li>• Identity — name, nation, birth year, gender</li>
            <li>• Discipline & current FIS points</li>
            <li>• World ranking</li>
            <li>• 12-month points history → growth trend</li>
            <li>• Recent results</li>
          </ul>
          {mode === "live" ? (
            <div className="mt-5 rounded-lg border border-[#7CFF6B40] bg-[#7cff6b08] p-4 text-xs text-[var(--color-muted)]">
              <span className="font-semibold text-[var(--color-accent)]">Live source.</span> Data is fetched in real time from the official FIS points-list CSV export at <span className="num">fis-ski.com</span>. A code that does not exist in the current list returns a clear &quot;not found&quot; error — never fake data.
            </div>
          ) : mode === "simulated" ? (
            <div className="mt-5 rounded-lg border border-[#f59e0b40] bg-[#f59e0b08] p-4 text-xs text-[var(--color-muted)]">
              <span className="font-semibold text-[#f59e0b]">Demo mode.</span> Every code returns deterministic curated data. To switch to real FIS lookups set <span className="num">FIS_PROVIDER=live</span> in the environment.
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-[#f59e0b40] bg-[#f59e0b08] p-4 text-xs text-[var(--color-muted)]">
              <span className="font-semibold text-[#f59e0b]">Auto mode.</span> Real FIS lookup with a silent fall-back to demo data when a code is not found. Safe for the public LEAF demo but risky for a real tenant — codes outside the live list will return realistic-looking fake records. Set <span className="num">FIS_PROVIDER=live</span> for strict real-data only.
            </div>
          )}
        </div>
      </div>

      <div className="px-8 pb-8">
        <BulkImportForm />
      </div>
    </>
  );
}

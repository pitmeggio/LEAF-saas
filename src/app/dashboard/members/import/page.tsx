import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ImportForm } from "@/components/ImportForm";
import { BulkImportForm } from "@/components/BulkImportForm";
import { DEMO_FIS_CODES } from "@/lib/fis/simulatedProvider";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import from FIS"
        subtitle="Enter a FIS code to auto-build the athlete's verified sports CV."
        right={
          <Link href="/dashboard/members" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            ← Back to athletes
          </Link>
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
          <div className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-xs text-[var(--color-muted)]">
            <span className="font-semibold text-[var(--color-fg)]">Prototype note:</span> data comes from a simulated FIS
            source behind a clean provider interface. The real FIS connector drops into one file
            (<span className="num">lib/fis/import.ts</span>) without changing this flow.
          </div>
        </div>
      </div>

      <div className="px-8 pb-8">
        <BulkImportForm />
      </div>
    </>
  );
}

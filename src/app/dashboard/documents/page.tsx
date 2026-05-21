import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, Dot } from "@/components/StatCard";
import { getDocumentsData } from "@/lib/ops";
import { getSession } from "@/lib/auth";
import { fmtDate, DOC_STATUS_COLOR } from "@/lib/domain";
import { DOC_LABEL } from "@/lib/enrollmentLogic";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const s = await getSession();
  const { docs, missing, expired } = await getDocumentsData(s?.isAdmin ? null : s?.coachId ?? null);
  const verified = docs.filter((d) => d.status === "verified").length;

  // Surface problem docs first
  const rows = [...docs].sort((a, b) => rank(a.status) - rank(b.status));

  return (
    <>
      <PageHeader title="Documents" subtitle="Missing and expired documents are detected automatically per athlete." />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total documents" value={String(docs.length)} />
          <StatCard label="Verified" value={String(verified)} accent />
          <StatCard label="Missing" value={String(missing.length)} danger={missing.length > 0} />
          <StatCard label="Expired" value={String(expired.length)} danger={expired.length > 0} />
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <th className="px-5 py-3 font-medium">Athlete</th><th className="px-3 py-3 font-medium">Document</th><th className="px-3 py-3 font-medium">Expires</th><th className="px-3 py-3 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/members/${d.enrollmentId}`} className="font-medium hover:underline">{d.enrollment.athlete.firstName} {d.enrollment.athlete.lastName}</Link>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-muted)]">{DOC_LABEL[d.type] ?? d.type}</td>
                  <td className="px-3 py-3 text-xs text-[var(--color-muted)]">{d.expiresAt ? fmtDate(d.expiresAt) : "—"}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize" style={{ color: DOC_STATUS_COLOR[d.status] }}>
                      <Dot color={DOC_STATUS_COLOR[d.status]} /> {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function rank(status: string): number {
  return status === "missing" ? 0 : status === "expired" ? 1 : status === "uploaded" ? 2 : 3;
}

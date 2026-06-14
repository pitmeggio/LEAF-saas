import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, Dot } from "@/components/StatCard";
import { DocumentUploader } from "@/components/DocumentUploader";
import { getDocumentsData } from "@/lib/ops";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtDate, DOC_STATUS_COLOR } from "@/lib/domain";
import { DOC_LABEL, ALL_DOC_TYPES } from "@/lib/enrollmentLogic";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const s = await getSession();
  const coachId = s?.isAdmin ? null : s?.coachId ?? null;
  const { docs, missing, expired } = await getDocumentsData(coachId);
  const verified = docs.filter((d) => d.status === "verified").length;

  // Athletes for the uploader picker — active/accepted enrollments, scoped to
  // the academy (and to the coach's own athletes when a coach is viewing).
  const enrollments = s?.academyId
    ? await prisma.enrollment.findMany({
        where: { academyId: s.academyId, status: { in: ["active", "accepted"] }, ...(coachId ? { coachId } : {}) },
        select: { id: true, athlete: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 300,
      })
    : [];
  const athletes = enrollments.map((e) => ({ enrollmentId: e.id, label: `${e.athlete.firstName} ${e.athlete.lastName}` }));
  const docTypes = ALL_DOC_TYPES.map((t) => ({ value: t, label: DOC_LABEL[t] ?? t }));

  // Surface problem docs first
  const rows = [...docs].sort((a, b) => rank(a.status) - rank(b.status));

  return (
    <>
      <PageHeader title="Documents" subtitle="Missing and expired documents are detected automatically per athlete." />
      <div className="space-y-6 p-8">
        {/* How-it-works banner — answers "what does Documents actually do?".
            LEAF tracks compliance (which athlete has which doc, expiry, alerts)
            AND now hosts the files in-app: upload a PDF / Word / Excel and it's
            stored against the athlete, with a signed-by-session download link. */}
        <div className="card flex items-start gap-3 p-4 text-xs">
          <span aria-hidden className="mt-0.5">▢</span>
          <div className="flex-1">
            <div className="font-medium text-[var(--color-fg)]/90">How Documents works</div>
            <p className="mt-0.5 leading-relaxed text-[var(--color-muted)]">
              LEAF auto-detects which documents each athlete still needs (medical,
              parental consent, FIS / FIT licence, insurance) and tracks expiry.
              Upload the file here — PDF, Word or Excel — and LEAF stores it against
              the athlete and marks the document <span className="font-medium">uploaded</span>.
            </p>
          </div>
          {athletes.length > 0 ? (
            <DocumentUploader athletes={athletes} docTypes={docTypes} />
          ) : (
            <span className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)]/70">
              No active athletes yet
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total documents" value={String(docs.length)} />
          <StatCard label="Verified" value={String(verified)} accent />
          <StatCard label="Missing" value={String(missing.length)} danger={missing.length > 0} />
          <StatCard label="Expired" value={String(expired.length)} danger={expired.length > 0} />
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <th className="px-5 py-3 font-medium">Athlete</th><th className="px-3 py-3 font-medium">Document</th><th className="px-3 py-3 font-medium">File</th><th className="px-3 py-3 font-medium">Expires</th><th className="px-3 py-3 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/athletes/${d.enrollmentId}`} className="font-medium hover:underline">{d.enrollment.athlete.firstName} {d.enrollment.athlete.lastName}</Link>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-muted)]">{DOC_LABEL[d.type] ?? d.type}</td>
                  <td className="px-3 py-3">
                    {d.fileName ? (
                      <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline">
                        ↓ {d.fileName.length > 24 ? d.fileName.slice(0, 21) + "…" : d.fileName}
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]/60">—</span>
                    )}
                  </td>
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

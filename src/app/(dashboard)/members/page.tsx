import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, TrendArrow, Verified } from "@/components/ui";
import { Dot } from "@/components/StatCard";
import { Modal, AthleteForm } from "@/components/EntityForms";
import { getActiveAthletes, getAssignmentOptions } from "@/lib/ops";
import { getSession } from "@/lib/auth";
import {
  DISCIPLINE_LABEL, COUNTRY, LEVEL_LABEL, age, fmtPoints,
  ENROLLMENT_STATUS_COLOR, PERF_COLOR,
} from "@/lib/domain";

export const dynamic = "force-dynamic";

const newBtn = "rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]";

export default async function MembersPage() {
  const s = await getSession();
  const coachScope = s?.isAdmin ? null : s?.coachId ?? null;
  const [members, opts] = await Promise.all([getActiveAthletes(coachScope), getAssignmentOptions()]);

  return (
    <>
      <PageHeader
        title="Active Athletes"
        subtitle="Enrolled members — sport, academy and operational status in one place."
        right={
          <div className="flex items-center gap-3">
            <span className="num text-sm text-[var(--color-muted)]">{members.length} members</span>
            <Modal label="+ New athlete" title="Add athlete" className={newBtn}><AthleteForm groups={opts.groups} coaches={opts.coaches} packages={opts.packages} /></Modal>
          </div>
        }
      />

      <div className="p-8">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <th className="px-5 py-3 font-medium">Athlete</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Level</th>
                <th className="px-3 py-3 font-medium">Group</th>
                <th className="px-3 py-3 font-medium">Coach</th>
                <th className="px-3 py-3 font-medium">FIS</th>
                <th className="px-3 py-3 font-medium">Perf</th>
                <th className="px-3 py-3 font-medium">Payments</th>
                <th className="px-3 py-3 font-medium">Docs</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                  <td className="px-5 py-3">
                    <Link href={`/members/${m.id}`} className="flex items-center gap-3">
                      <Avatar first={m.athlete.firstName} last={m.athlete.lastName} color={m.athlete.photoColor} size={34} />
                      <span>
                        <span className="flex items-center gap-2 font-medium">
                          {m.athlete.firstName} {m.athlete.lastName} {m.athlete.verified && <Verified />}
                        </span>
                        <span className="text-xs text-[var(--color-muted)]">
                          {COUNTRY[m.athlete.nationality]?.flag} {age(m.athlete.dob)}y · {DISCIPLINE_LABEL[m.athlete.discipline]}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs capitalize">
                      <Dot color={ENROLLMENT_STATUS_COLOR[m.status] ?? "#8a93a6"} /> {m.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-muted)]">{m.level ? LEVEL_LABEL[m.level] : "—"}</td>
                  <td className="px-3 py-3 text-[var(--color-muted)]">{m.group?.name ?? "—"}</td>
                  <td className="px-3 py-3 text-[var(--color-muted)]">{m.coach?.name ?? "—"}</td>
                  <td className="num px-3 py-3">{fmtPoints(m.athlete.fisPoints)}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs capitalize" style={{ color: PERF_COLOR[m.perf] }}>
                      <TrendArrow trend={m.trend} />
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {m.overduePayments.length > 0 ? (
                      <span className="text-xs font-medium text-[#f87171]">{m.overduePayments.length} overdue</span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">ok</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {m.missingDocs.length > 0 ? (
                      <span className="text-xs font-medium text-[#f59e0b]">{m.missingDocs.length} missing</span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">complete</span>
                    )}
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

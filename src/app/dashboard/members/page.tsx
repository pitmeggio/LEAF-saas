import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, Verified } from "@/components/ui";
import { Dot } from "@/components/StatCard";
import { Modal, AthleteForm } from "@/components/EntityForms";
import { AthleteSportCell } from "@/components/AthleteSportCell";
import { getActiveAthletes, getAssignmentOptions } from "@/lib/ops";
import { getCurrentUser, getSession } from "@/lib/auth";
import {
  DISCIPLINE_LABEL, COUNTRY, LEVEL_LABEL, age,
  ENROLLMENT_STATUS_COLOR,
} from "@/lib/domain";
import { getSportModuleForAcademy } from "@/lib/sports/registry";

export const dynamic = "force-dynamic";

const newBtn = "rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]";

export default async function MembersPage() {
  const s = await getSession();
  const user = await getCurrentUser();
  const coachScope = s?.isAdmin ? null : s?.coachId ?? null;
  const [members, opts] = await Promise.all([getActiveAthletes(coachScope), getAssignmentOptions()]);
  // Sport-aware columns — the active sport module decides what shows between
  // Coach and Payments (FIS pts/Trend for ski; Style/Levels for tennis).
  const sport = getSportModuleForAcademy(user?.academy);
  const sportCols = sport.athletesListColumns;

  // Guided view: surface who needs a human. Flagged athletes sort to the top.
  const flagged = members.map((m) => ({
    m,
    needs: m.overduePayments.length > 0 || m.missingDocs.length > 0 || m.perf === "declining",
  }));
  const needCount = flagged.filter((f) => f.needs).length;
  const sorted = [...flagged].sort((a, b) => Number(b.needs) - Number(a.needs));

  return (
    <>
      <PageHeader
        title="Active Athletes"
        subtitle={`${sport.label} workspace · enrolled members, academy and operational status in one place.`}
        right={
          <div className="flex items-center gap-3">
            <span className="num text-sm text-[var(--color-muted)]">{members.length} members</span>
            <Modal label="+ New athlete" title="Add athlete" className={newBtn}><AthleteForm groups={opts.groups} coaches={opts.coaches} packages={opts.packages} /></Modal>
          </div>
        }
      />

      <div className="space-y-4 p-8">
        {/* Guided summary — only the few that need a human */}
        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm">
          <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
          {needCount === 0 ? (
            <span className="text-[var(--color-fg)]/85">All {members.length} athletes on track — nothing needs you right now.</span>
          ) : (
            <span className="text-[var(--color-fg)]/85"><span className="font-semibold">{needCount} of {members.length} need a look</span> <span className="text-[var(--color-muted)]">— overdue payments, missing docs or a declining trend. They're at the top.</span></span>
          )}
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <th className="px-5 py-3 font-medium">Athlete</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Level</th>
                <th className="px-3 py-3 font-medium">Group</th>
                <th className="px-3 py-3 font-medium">Coach</th>
                {/* Sport-specific columns — declared by the active sport module. */}
                {sportCols.map((c) => (
                  <th
                    key={c.key}
                    className={`px-3 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}
                    title={c.hint}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-3 font-medium">Payments</th>
                <th className="px-3 py-3 font-medium">Docs</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ m, needs }) => (
                <tr key={m.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]" style={needs ? { boxShadow: "inset 2px 0 0 #f59e0b" } : undefined}>
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/members/${m.id}`} className="flex items-center gap-3">
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
                  {/* Sport-specific cells — same order as the headers above. */}
                  {sportCols.map((c) => (
                    <td key={c.key} className={`px-3 py-3 ${c.align === "right" ? "text-right" : ""}`}>
                      <AthleteSportCell field={c.field} athlete={m.athlete} trend={m.trend} />
                    </td>
                  ))}
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

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/auth";
import { getAttendanceGroups, getAttendanceBoard } from "@/lib/ops";
import { AttendanceBoard } from "@/components/AttendanceBoard";

export const dynamic = "force-dynamic";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const { group: groupParam } = await searchParams;
  const session = await getSession();
  const coachId = session?.isAdmin || session?.isSuperAdmin ? null : session?.coachId ?? null;

  const groups = await getAttendanceGroups(coachId);
  const groupId = groupParam && groups.some((g) => g.id === groupParam) ? groupParam : groups[0]?.id ?? null;
  const board = groupId ? await getAttendanceBoard(groupId, coachId) : null;

  return (
    <>
      <PageHeader title="Attendance" subtitle="Track training session attendance per group." />
      <div className="p-8">
        {groups.length === 0 ? (
          <div className="card p-10 text-center text-sm text-[var(--color-muted)]">No groups yet. Create a group first.</div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-2">
              {groups.map((g) => (
                <Link
                  key={g.id}
                  href={`/dashboard/attendance?group=${g.id}`}
                  className={`rounded-lg border px-3.5 py-2 text-sm font-medium ${g.id === groupId ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-fg)]" : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}
                >
                  {g.name}
                </Link>
              ))}
            </div>

            {board && (
              <AttendanceBoard
                groupId={board.group.id}
                roster={board.roster}
                sessions={board.sessions.map((s) => ({ id: s.id, date: s.date.toISOString(), title: s.title, records: s.records }))}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

import { PageHeader } from "@/components/PageHeader";
import { requireAcademyId } from "@/lib/auth";
import { getStaffBoard } from "@/lib/board/board";
import { BoardComposer } from "@/components/BoardComposer";
import { BoardAnnouncementRow } from "@/components/BoardAnnouncementRow";

export const dynamic = "force-dynamic";

// LEAF — Bacheca (Squad Board). Staff broadcast to the whole academy or a
// single group; every post shows live read + acknowledge receipts (the
// Teamworks "seen by / confirmed by" loop) so nothing important goes unread.
export default async function BoardPage() {
  const academyId = await requireAcademyId();
  const board = await getStaffBoard(academyId);
  const nowMs = Date.now();

  const totalRead = board.announcements.reduce((s, a) => s + a.readCount, 0);
  const totalReach = board.announcements.reduce((s, a) => s + a.audienceSize, 0);
  const avgRead = totalReach ? Math.round((totalRead / totalReach) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Bacheca"
        subtitle="Comunicazioni alla squadra — con conferma di lettura in tempo reale."
      />
      <div className="space-y-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            <Stat label="Comunicazioni" value={String(board.announcements.length)} />
            <Stat label="Atleti raggiunti" value={String(board.rosterSize)} />
            <Stat label="Lettura media" value={`${avgRead}%`} />
          </div>
          <BoardComposer groups={board.groups} />
        </div>

        {board.announcements.length === 0 ? (
          <div className="card p-10 text-center text-sm text-[var(--color-muted)]">
            Nessuna comunicazione. Pubblica la prima — comparirà subito nell&apos;app degli atleti con la conferma di lettura.
          </div>
        ) : (
          <div className="space-y-3">
            {board.announcements.map((a) => <BoardAnnouncementRow key={a.id} a={a} nowMs={nowMs} />)}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="kicker">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
    </div>
  );
}

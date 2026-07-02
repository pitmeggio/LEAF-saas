import { requireAthleteId } from "@/lib/auth";
import { getAthleteBoard } from "@/lib/board/board";
import { AnnouncementCard } from "@/components/app/AnnouncementCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bacheca · LEAF" };

export default async function BoardPage() {
  const athleteId = await requireAthleteId();
  const board = await getAthleteBoard(athleteId);
  const nowMs = Date.now();
  const unread = board.filter((a) => !a.read).length;

  return (
    <div className="px-4 pt-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Bacheca</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Comunicazioni dallo staff.{unread > 0 && <span className="ml-1 text-[var(--color-accent)]">{unread} da leggere</span>}
        </p>
      </header>

      {board.length === 0 ? (
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-8 text-center text-sm text-[var(--color-muted)]">
          Nessuna comunicazione al momento.
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {board.map((a) => (
            <AnnouncementCard key={a.id} a={a} nowMs={nowMs} />
          ))}
        </div>
      )}
    </div>
  );
}

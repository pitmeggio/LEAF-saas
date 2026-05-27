import { PageHeader } from "@/components/PageHeader";
import { LineScheduleGrid } from "@/components/LineScheduleGrid";
import { LineImportButton } from "@/components/LineImportButton";
import { CreateSlopeButton } from "@/components/CreateSlopeButton";
import { PublicBookingLinksCard } from "@/components/PublicBookingLinksCard";
import { getSession, requireAcademyId } from "@/lib/auth";
import { getWeeklySchedule, mondayOf } from "@/lib/lines";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// LEAF OS Essential — Line Schedule.
//
// Renders the academy's slopes × lines × time-slots grid for a given
// week, mirroring the exact layout coaches keep in Excel today. Each
// cell is one booking: internal-team training (yellow) or Pay-and-Train
// public slot (green). Admin can drop new bookings, toggle slots to
// public, or import the whole week from a Treningsskjema.xlsx file.
export default async function LineSchedulePage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const s = await getSession();
  const academyId = await requireAcademyId();
  const isAdmin = s?.isAdmin ?? false;

  const sp = await searchParams;
  // `w` is the Monday of the requested week as YYYY-MM-DD; default = this week.
  const requested = sp.w ? new Date(sp.w) : new Date();
  const weekStart = mondayOf(Number.isFinite(requested.getTime()) ? requested : new Date());

  const [{ slopes, bookings }, academy] = await Promise.all([
    getWeeklySchedule(academyId, weekStart),
    prisma.academy.findUnique({ where: { id: academyId }, select: { slug: true } }),
  ]);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  return (
    <>
      <PageHeader
        title="Line Schedule"
        subtitle={`Week ${fmt(weekStart)} – ${fmt(weekEnd)} · ${slopes.length} slope${slopes.length === 1 ? "" : "s"}, ${slopes.reduce((s, x) => s + x.lines.length, 0)} lines · click an empty cell to book, click an existing slot to manage it.`}
        right={isAdmin ? (
          <div className="flex items-center gap-2">
            <CreateSlopeButton />
            <LineImportButton />
          </div>
        ) : undefined}
      />
      <div className="space-y-6 p-8">
        {isAdmin && academy && <PublicBookingLinksCard slug={academy.slug} />}
        {slopes.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <div className="text-2xl">🎿</div>
            <h2 className="text-base font-semibold">No slopes configured yet</h2>
            <p className="max-w-md text-sm text-[var(--color-muted)]">
              Add your first slope to start building the line schedule. Trysil Race Center has Slope 63 (5 lines) and Slope 80 (3 lines) — recreate yours here and the rest of LEAF Essential lights up.
            </p>
          </div>
        ) : (
          <LineScheduleGrid
            slopes={slopes}
            bookings={bookings}
            weekStart={weekStart}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </>
  );
}

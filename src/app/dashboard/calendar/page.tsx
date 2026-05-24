import { PageHeader } from "@/components/PageHeader";
import { CalendarManager, type CalendarEventRow } from "@/components/CalendarManager";
import { getSession, requireAcademyId } from "@/lib/auth";
import { getCalendarEvents, type CalendarScope } from "@/lib/calendar";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const s = await getSession();
  const academyId = await requireAcademyId();
  const isAdmin = s?.isAdmin ?? false;

  const scope: CalendarScope = isAdmin
    ? { kind: "admin", academyId }
    : { kind: "coach", academyId, coachId: s?.coachId ?? "" };

  // Coaches only see their own groups in the picker; admin sees all.
  const groups = await prisma.group.findMany({
    where: { academyId, active: true, ...(isAdmin ? {} : { coachId: s?.coachId ?? "_none_" }) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const events = await getCalendarEvents(scope);
  const rows: CalendarEventRow[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    season: e.season,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    location: e.location,
    notes: e.notes,
    group: e.group ? { id: e.group.id, name: e.group.name } : null,
    coach: e.coach ? { id: e.coach.id, name: e.coach.name } : null,
  }));

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={isAdmin ? "Summer, autumn and winter programmes — for the whole academy or per team." : "Your groups' events. Athletes see their own schedule on their profile."}
      />
      <div className="p-8">
        <CalendarManager events={rows} groups={groups} canCreateAcademyWide={isAdmin} />
      </div>
    </>
  );
}

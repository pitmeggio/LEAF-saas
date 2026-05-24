import { PageHeader } from "@/components/PageHeader";
import { SeasonPlanner, type GroupOpt } from "@/components/SeasonPlanner";
import { getSession, requireAcademyId } from "@/lib/auth";
import { getCalendarEvents, type CalendarScope } from "@/lib/calendar";
import { getAcademyCurrency, getGroupsWithStats } from "@/lib/ops";
import type { EventLite } from "@/lib/planning";

export const dynamic = "force-dynamic";

// Season Planning + Budget OS — the planner is a spreadsheet over days of the
// selected month, with the academy-wide budget / spend / forecast / risk on top
// and a deterministic AI hint when the plan exposes the budget.
export default async function CalendarPage() {
  const s = await getSession();
  const academyId = await requireAcademyId();
  const isAdmin = s?.isAdmin ?? false;

  const scope: CalendarScope = isAdmin
    ? { kind: "admin", academyId }
    : { kind: "coach", academyId, coachId: s?.coachId ?? "" };

  const [groupsStats, currency, events] = await Promise.all([
    getGroupsWithStats(isAdmin ? null : s?.coachId ?? null),
    getAcademyCurrency(),
    getCalendarEvents(scope),
  ]);

  // Group options shown in the planner.
  const groups: GroupOpt[] = groupsStats
    .filter((g) => g.active)
    .map((g) => ({ id: g.id, name: g.name, budget: g.budget }));

  // KPI inputs (in base currency): sum allocated budgets + sum used budgets across visible groups.
  const totalBudget = groupsStats.reduce((s, g) => s + (g.budget ?? 0), 0);
  const spent = groupsStats.reduce((s, g) => s + g.usedBudget, 0);

  const rows: EventLite[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    season: e.season,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    location: e.location,
    planBLocation: e.planBLocation,
    discipline: e.discipline,
    coachesNote: e.coachesNote,
    notes: e.notes,
    groupId: e.groupId,
    groupName: e.group?.name ?? null,
    estimatedCost: e.estimatedCost,
    actualCost: e.actualCost,
    costHotel: e.costHotel, costFlights: e.costFlights, costVan: e.costVan, costFuel: e.costFuel,
    costLiftPass: e.costLiftPass, costCoach: e.costCoach, costAccommodation: e.costAccommodation,
    costRaceFees: e.costRaceFees, costMisc: e.costMisc,
  }));

  return (
    <>
      <PageHeader
        title="Season Planner"
        subtitle={isAdmin ? "Spreadsheet-style preseason planner — events, costs and budget exposure in one view." : "Your groups' plan — events, locations and costs."}
      />
      <div className="p-8">
        <SeasonPlanner
          events={rows}
          groups={groups}
          currency={currency}
          totalBudget={totalBudget}
          spent={spent}
          canCreateAcademyWide={isAdmin}
        />
      </div>
    </>
  );
}

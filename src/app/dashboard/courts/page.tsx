import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import { CreateFacilityButton } from "@/components/CreateFacilityButton";
import { CourtBookingGrid } from "@/components/CourtBookingGrid";
import { getCourtsForBooking, getCourtBookingsForDay } from "@/lib/courts";

export const dynamic = "force-dynamic";

// LEAF OS Essential Tennis — Court Stage.
//
// The booking grid is the heart: one day at a time, courts as columns,
// 08:00–22:00 as rows. Click an empty slot to book (lezione / corso /
// socio / manutenzione), with one-click weekly recurrence so a fixed
// course is laid down for the whole season in a single action. Below it,
// the catalogue of facilities + courts the academy has set up.
export default async function CourtsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const academyId = await requireAcademyId();
  const sp = await searchParams;
  const todayISO = new Date().toISOString().slice(0, 10);
  const dateISO = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayISO;

  const [academy, facilities, courts, bookings, groups] = await Promise.all([
    prisma.academy.findUnique({ where: { id: academyId }, select: { name: true, logoColor: true } }),
    prisma.tennisFacility.findMany({ where: { academyId }, include: { courts: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "asc" } }),
    getCourtsForBooking(),
    getCourtBookingsForDay(dateISO),
    prisma.group.findMany({ where: { academyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const totalCourts = facilities.reduce((s, f) => s + f.courts.length, 0);

  return (
    <>
      <PageHeader
        title="Campi"
        subtitle={`${facilities.length} ${facilities.length === 1 ? "sede" : "sedi"} · ${totalCourts} ${totalCourts === 1 ? "campo" : "campi"}`}
        right={<CreateFacilityButton />}
      />
      <div className="space-y-8 p-8">
        {facilities.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <div className="text-2xl">🎾</div>
            <h2 className="text-base font-semibold">Nessuna sede ancora</h2>
            <p className="max-w-md text-sm text-[var(--color-muted)]">
              Aggiungi la prima sede del tuo club. LEAF crea automaticamente i campi numerati e da quel momento puoi gestire le prenotazioni dal grid.
            </p>
          </div>
        ) : (
          <>
            {/* Booking grid */}
            <CourtBookingGrid dateISO={dateISO} todayISO={todayISO} courts={courts} bookings={bookings} groups={groups} />

            {/* Facilities catalogue */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-[var(--color-muted)]">Le tue sedi</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {facilities.map((f) => (
                  <div key={f.id} className="card relative overflow-hidden p-5">
                    <div
                      className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
                      style={{ background: `radial-gradient(circle, ${academy?.logoColor ?? "#a78bfa"}66, transparent)` }}
                    />
                    <div className="relative">
                      <div className="kicker">Sede</div>
                      <div className="mt-1 text-xl font-semibold">{f.name}</div>
                      {f.address && <div className="mt-0.5 text-xs text-[var(--color-muted)]">{f.address}</div>}
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {f.courts.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 px-3 py-2.5"
                          >
                            <div>
                              <div className="text-xs font-semibold">{c.label}</div>
                              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                                {c.surface ?? "—"}
                                {c.indoor ? " · indoor" : ""}
                              </div>
                            </div>
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ background: c.surface === "clay" ? "#d97706" : c.surface === "hard" ? "#3b82f6" : c.surface === "grass" ? "#22c55e" : "#94a3b8" }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

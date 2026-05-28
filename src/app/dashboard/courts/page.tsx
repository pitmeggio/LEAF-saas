import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";
import { CreateFacilityButton } from "@/components/CreateFacilityButton";

export const dynamic = "force-dynamic";

// LEAF OS Essential Tennis — Court Stage.
//
// Tennis analogue of /dashboard/lines. Shows the academy's facilities +
// courts as oversized cards with court count, surface, indoor/outdoor.
// In a later iteration this becomes an isometric SVG of each facility
// with bookings overlaid as glowing chips. For tonight: cards + counts
// + the "add facility" action so Max can build out his sites.
export default async function CourtsPage() {
  const academyId = await requireAcademyId();
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { name: true, logoColor: true } });

  const facilities = await prisma.tennisFacility.findMany({
    where: { academyId },
    include: { courts: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const totalCourts = facilities.reduce((s, f) => s + f.courts.length, 0);

  return (
    <>
      <PageHeader
        title="Campi"
        subtitle={`${facilities.length} ${facilities.length === 1 ? "sede" : "sedi"} · ${totalCourts} ${totalCourts === 1 ? "campo" : "campi"}`}
        right={<CreateFacilityButton />}
      />
      <div className="space-y-6 p-8">
        {facilities.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <div className="text-2xl">🎾</div>
            <h2 className="text-base font-semibold">Nessuna sede ancora</h2>
            <p className="max-w-md text-sm text-[var(--color-muted)]">
              Aggiungi la prima sede del tuo club. LEAF crea automaticamente i campi numerati e da quel momento puoi gestire le prenotazioni dal grid.
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </>
  );
}

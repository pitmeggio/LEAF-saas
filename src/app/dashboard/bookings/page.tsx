import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAcademyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// LEAF OS Essential — incoming Pay-and-Train bookings.
// Lists every slot that an external customer has bought through the
// public `/book` widget. Internal team bookings live on the schedule
// grid (not here) so this inbox stays focused on revenue events.
export default async function BookingsPage() {
  const academyId = await requireAcademyId();
  const [academy, bookings] = await Promise.all([
    prisma.academy.findUnique({ where: { id: academyId }, select: { currency: true } }),
    prisma.lineBooking.findMany({
      where: { academyId, customerEmail: { not: null } },
      include: { line: { include: { slope: true } } },
      orderBy: { startAt: "desc" },
      take: 100,
    }),
  ]);
  const currency = academy?.currency ?? "EUR";

  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const fmtTime = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="Everything booked through your public site — Pay-and-Train customers (Jonas) and visiting clubs."
      />
      <div className="p-8">
        {bookings.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <div className="text-2xl">📥</div>
            <h2 className="text-base font-semibold">No bookings yet</h2>
            <p className="max-w-md text-sm text-[var(--color-muted)]">
              The moment someone books a Pay-and-Train session or grabs a free line through your public booking
              links, it lands here with their contact details.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Date · Time</th>
                  <th className="px-4 py-2 text-left">Slope · Line</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const isExternalClub = !b.payAndTrainEnabled && b.bookerOrg != null;
                  return (
                  <tr key={b.id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${
                        isExternalClub
                          ? "bg-[#a78bfa]/15 text-[#a78bfa]"
                          : "bg-[#38bdf8]/15 text-[#38bdf8]"
                      }`}>
                        {isExternalClub ? "External club" : "Pay-and-Train"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{b.customerName}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">{b.customerEmail}</div>
                      {b.bookerOrg && (
                        <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{b.bookerOrg}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <div>{fmt(b.startAt)}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">{fmtTime(b.startAt)}–{fmtTime(b.endAt)}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div>{b.line.slope.name}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">Line {b.line.label}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right num">
                      {b.publicPrice ? `${currency} ${b.publicPrice.toLocaleString("en-US")}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                        b.status === "confirmed" ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" :
                        b.status === "pending" ? "bg-[#f59e0b]/15 text-[#f59e0b]" :
                        "bg-[#f87171]/15 text-[#f87171]"
                      }`}>{b.status}</span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

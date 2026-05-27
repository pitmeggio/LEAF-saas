import { notFound } from "next/navigation";
import Link from "next/link";
import { getLineBookingAvailability, mondayOf, DEFAULT_TIME_SLOTS } from "@/lib/lines";
import { prisma } from "@/lib/db";
import { PublicNav } from "@/components/PublicNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PublicLineGrid } from "@/components/PublicLineGrid";

export const dynamic = "force-dynamic";

// Public weekly grid for external club coaches. Any cell that isn't held
// by an internal team, a Pay-and-Train customer, or another club shows
// as a clickable "free" cell — clicking opens the booking form.
//
// Designed to be embeddable on the academy's own website: keep chrome
// minimal, lean on the grid + form.
export default async function BookLinePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ w?: string; ok?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const academyMeta = await prisma.academy.findUnique({
    where: { slug },
    select: { tier: true, name: true, location: true, logoColor: true },
  });
  if (!academyMeta) notFound();
  if (academyMeta.tier !== "essential" && academyMeta.tier !== "complete") notFound();

  const weekStart = sp.w ? mondayOf(new Date(sp.w)) : mondayOf(new Date());
  const data = await getLineBookingAvailability(slug, weekStart);
  if (!data) notFound();

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${new Date(
    weekStart.getTime() + 6 * 86400_000,
  ).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;

  const success = sp.ok === "1";

  return (
    <div className="min-h-screen">
      <PublicNav />

      <header className="sticky top-[57px] z-20 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-5 py-3 backdrop-blur md:top-[61px] md:px-12">
        <Link href={`/academy/${slug}`} className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg font-black"
            style={{ background: academyMeta.logoColor, color: "#0a0c10" }}
          >
            {academyMeta.name[0]}
          </div>
          <span className="font-semibold">{academyMeta.name}</span>
        </Link>
        <span className="hidden text-[10px] uppercase tracking-wide text-[var(--color-muted)] sm:inline">
          Line booking · powered by LEAF
        </span>
      </header>

      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-[8%] top-[-120px] h-[320px] w-[520px] glow-accent" />
        <div className="relative mx-auto max-w-6xl px-5 py-10 md:px-12 md:py-12">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>
            For visiting clubs
          </div>
          <h1 className="display mt-1 text-3xl font-bold leading-[1.05] md:text-4xl">
            Book a training line on {academyMeta.name}
          </h1>
          <p className="mt-3 max-w-3xl text-base text-[var(--color-fg)]/80">
            Pick any free cell on the weekly grid. Your booking lands on the academy&apos;s schedule immediately —
            no email, no phone calls.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-8 md:px-12">
        {success && (
          <div className="card flex items-start gap-3 border-[var(--color-accent)] p-5">
            <div className="text-xl">✓</div>
            <div>
              <div className="text-sm font-semibold">Line booked</div>
              <div className="mt-1 text-sm text-[var(--color-muted)]">
                {academyMeta.name} has been notified. You&apos;ll receive an invoice + arrival details by email.
              </div>
            </div>
          </div>
        )}

        {/* Week nav */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="kicker">Week</div>
            <div className="text-lg font-semibold">{weekLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/academy/${slug}/book/line?w=${prevWeek.toISOString().slice(0, 10)}`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              ← Prev
            </Link>
            <Link
              href={`/academy/${slug}/book/line`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              This week
            </Link>
            <Link
              href={`/academy/${slug}/book/line?w=${nextWeek.toISOString().slice(0, 10)}`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              Next →
            </Link>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-muted)]">
          <LegendDot color="bg-[var(--color-accent)]/30 border-[var(--color-accent)]" label="Free — click to book" />
          <LegendDot color="bg-[#facc15]/20 border-[#facc15]/40" label={`${academyMeta.name} team`} />
          <LegendDot color="bg-[#60a5fa]/20 border-[#60a5fa]/40" label="Pay-and-Train" />
          <LegendDot color="bg-[#a78bfa]/20 border-[#a78bfa]/40" label="Another club" />
        </div>

        {/* The interactive grid */}
        <PublicLineGrid
          slug={slug}
          slopes={data.slopes}
          bookings={data.bookings.map((b) => ({
            ...b,
            startAt: b.startAt.toISOString(),
            endAt: b.endAt.toISOString(),
          }))}
          weekStart={weekStart.toISOString()}
          slots={DEFAULT_TIME_SLOTS}
          weekParam={sp.w ?? ""}
        />

        <div className="card flex items-start gap-3 p-5 text-sm text-[var(--color-muted)]">
          <span style={{ color: "var(--color-accent)" }}>i</span>
          <div>
            Click any green cell to book it. {academyMeta.name} sees your booking the moment you confirm — no
            email tag, no calls. After your session they send an invoice from LEAF.
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-3 w-5 rounded border ${color}`} />
      {label}
    </span>
  );
}

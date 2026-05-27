import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicAvailability, mondayOf } from "@/lib/lines";
import { prisma } from "@/lib/db";
import { PublicNav } from "@/components/PublicNav";
import { SiteFooter } from "@/components/SiteFooter";
import { BookSlotForm } from "@/components/BookSlotForm";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ w?: string; ok?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  // Gate on tier so a "professional"-only academy doesn't expose this page.
  const academyMeta = await prisma.academy.findUnique({
    where: { slug },
    select: { tier: true, name: true, sport: true, currency: true, location: true, logoColor: true },
  });
  if (!academyMeta) notFound();
  if (academyMeta.tier !== "essential" && academyMeta.tier !== "complete") notFound();

  const weekStart = sp.w ? mondayOf(new Date(sp.w)) : mondayOf(new Date());
  const data = await getPublicAvailability(slug, weekStart);
  if (!data) notFound();

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Group open slots by day-of-week (0=Mon)
  const slotsByDay = new Map<number, typeof data.openSlots>();
  for (const s of data.openSlots) {
    const d = new Date(s.startAt);
    const jsDay = d.getDay(); // 0=Sun..6=Sat
    const mondayIdx = jsDay === 0 ? 6 : jsDay - 1;
    if (!slotsByDay.has(mondayIdx)) slotsByDay.set(mondayIdx, []);
    slotsByDay.get(mondayIdx)!.push(s);
  }

  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${new Date(
    weekStart.getTime() + 6 * 86400_000,
  ).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;

  const currency = academyMeta.currency ?? data.academy.currency ?? "NOK";
  const totalOpen = data.openSlots.length;
  const success = sp.ok === "1";

  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* Academy bar */}
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
          Pay-and-Train · powered by LEAF
        </span>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-[8%] top-[-120px] h-[320px] w-[520px] glow-accent" />
        <div className="relative mx-auto max-w-5xl px-5 py-12 md:px-12 md:py-16">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>
            Pay-and-Train
          </div>
          <h1 className="display mt-1 text-4xl font-bold leading-[1.05] md:text-5xl">
            Train on {academyMeta.name}&apos;s lines
          </h1>
          <p className="mt-4 max-w-2xl text-base text-[var(--color-fg)]/80">
            Open training slots on {academyMeta.location ?? "the slopes"}. Pick a session, leave your details,
            and you&apos;re on the line — no contract, no season commitment.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-5 py-10 md:px-12">
        {success && (
          <div className="card flex items-start gap-3 border-[var(--color-accent)] p-5">
            <div className="text-xl">✓</div>
            <div>
              <div className="text-sm font-semibold">Booking confirmed</div>
              <div className="mt-1 text-sm text-[var(--color-muted)]">
                You&apos;ll receive a confirmation email shortly with arrival details and payment instructions.
              </div>
            </div>
          </div>
        )}

        {/* Week nav */}
        <div className="flex items-center justify-between">
          <div>
            <div className="kicker">Week</div>
            <div className="text-lg font-semibold">{weekLabel}</div>
            <div className="mt-0.5 text-xs text-[var(--color-muted)]">
              {totalOpen} {totalOpen === 1 ? "slot" : "slots"} available
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/academy/${slug}/book/pay-and-train?w=${prevWeek.toISOString().slice(0, 10)}`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              ← Prev
            </Link>
            <Link
              href={`/academy/${slug}/book/pay-and-train`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              This week
            </Link>
            <Link
              href={`/academy/${slug}/book/pay-and-train?w=${nextWeek.toISOString().slice(0, 10)}`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
            >
              Next →
            </Link>
          </div>
        </div>

        {/* Slot list, grouped by day */}
        {totalOpen === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-12 text-center">
            <div className="text-2xl">🎿</div>
            <h2 className="text-base font-semibold">No open slots this week</h2>
            <p className="max-w-md text-sm text-[var(--color-muted)]">
              The team is using every line right now. Try a different week — or get in touch to be notified when slots open.
            </p>
            <Link
              href={`/academy/${slug}`}
              className="mt-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-surface-2)]"
            >
              Back to academy
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {DAY_LABELS.map((dayLabel, dayIdx) => {
              const daySlots = slotsByDay.get(dayIdx) ?? [];
              if (daySlots.length === 0) return null;
              const date = new Date(weekStart);
              date.setDate(date.getDate() + dayIdx);
              return (
                <section key={dayIdx} className="space-y-3">
                  <div className="flex items-baseline gap-3 border-b border-[var(--color-border)] pb-2">
                    <h3 className="text-base font-semibold">{dayLabel}</h3>
                    <span className="text-xs text-[var(--color-muted)]">
                      {date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {daySlots.map((s) => (
                      <SlotCard
                        key={s.id}
                        slug={slug}
                        slot={s}
                        currency={currency}
                        weekParam={sp.w ?? ""}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="card flex items-start gap-3 p-5 text-sm text-[var(--color-muted)]">
          <span style={{ color: "var(--color-accent)" }}>i</span>
          <div>
            Pay-and-Train slots are managed by {academyMeta.name} through LEAF. Once you book, the academy
            confirms your spot and sends arrival + payment details by email.
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

function SlotCard({
  slug,
  slot,
  currency,
  weekParam,
}: {
  slug: string;
  slot: { id: string; lineLabel: string; slopeName: string; startAt: Date; endAt: Date; price: number; discipline: string | null };
  currency: string;
  weekParam: string;
}) {
  const startTime = new Date(slot.startAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = new Date(slot.endAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const priceLabel = slot.price > 0 ? `${currency} ${slot.price.toLocaleString("en-US")}` : "Contact for price";

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">
            {startTime} – {endTime}
          </div>
          <div className="mt-0.5 text-xs text-[var(--color-muted)]">
            {slot.slopeName} · Line {slot.lineLabel}
            {slot.discipline ? ` · ${slot.discipline}` : ""}
          </div>
        </div>
        <div className="num text-sm font-semibold" style={{ color: "var(--color-accent)" }}>
          {priceLabel}
        </div>
      </div>
      <BookSlotForm slug={slug} slotId={slot.id} weekParam={weekParam} />
    </div>
  );
}

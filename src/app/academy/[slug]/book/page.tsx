import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PublicNav } from "@/components/PublicNav";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

// Landing page for an academy's public booking surface — two flows live
// underneath it:
//   /book/pay-and-train   — parents book a Pay-and-Train session (Jonas)
//   /book/line            — visiting club coach grabs a free training line
//
// Marius pastes the parent URL on the Trysil home page next to the
// "Train with us" CTA, and the club-coach URL on his B2B page.
export default async function BookLanding({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academy = await prisma.academy.findUnique({
    where: { slug },
    select: { name: true, location: true, logoColor: true, tier: true },
  });
  if (!academy) notFound();
  if (academy.tier !== "essential" && academy.tier !== "complete") notFound();

  return (
    <div className="min-h-screen">
      <PublicNav />

      <header className="sticky top-[57px] z-20 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-5 py-3 backdrop-blur md:top-[61px] md:px-12">
        <Link href={`/academy/${slug}`} className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg font-black"
            style={{ background: academy.logoColor, color: "#0a0c10" }}
          >
            {academy.name[0]}
          </div>
          <span className="font-semibold">{academy.name}</span>
        </Link>
        <span className="hidden text-[10px] uppercase tracking-wide text-[var(--color-muted)] sm:inline">
          Book · powered by LEAF
        </span>
      </header>

      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-[8%] top-[-120px] h-[320px] w-[520px] glow-accent" />
        <div className="relative mx-auto max-w-4xl px-5 py-12 md:px-12 md:py-16">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>
            Book on {academy.name}
          </div>
          <h1 className="display mt-1 text-4xl font-bold leading-[1.05] md:text-5xl">
            How do you want to train?
          </h1>
          <p className="mt-4 max-w-2xl text-base text-[var(--color-fg)]/80">
            Two ways to ski with {academy.name}: a Pay-and-Train session with our coach, or your club grabs
            an open training line for your own team.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-10 md:px-12">
        <div className="grid gap-5 md:grid-cols-2">
          <BookingTile
            href={`/academy/${slug}/book/pay-and-train`}
            kicker="For parents · individual athletes"
            title="Pay-and-Train"
            description={`A session with ${academy.name}'s coach. Pre-set slots, pre-set price — pick one, leave your details, you're on the line.`}
            bullets={[
              "Coached by our Pay-and-Train staff",
              "Single session, no contract",
              "Confirmation by email",
            ]}
            cta="See open sessions"
            accent
          />
          <BookingTile
            href={`/academy/${slug}/book/line`}
            kicker="For visiting clubs · external coaches"
            title="Book a training line"
            description={`Bring your own team to ${academy.location ?? "our slopes"}. Pick a free line on the live grid — no email, no calls.`}
            bullets={[
              "You coach your athletes",
              "Live availability — no double-booking",
              `Invoice from ${academy.name} after`,
            ]}
            cta="Open the line grid"
          />
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

function BookingTile({
  href,
  kicker,
  title,
  description,
  bullets,
  cta,
  accent,
}: {
  href: string;
  kicker: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="card group relative flex flex-col gap-3 p-6 transition-colors hover:border-[var(--color-accent)]"
      style={accent ? { borderColor: "var(--color-accent)" } : undefined}
    >
      {accent && (
        <span
          className="absolute inset-x-0 top-0 h-[2px] rounded-t-[14px]"
          style={{ background: "var(--color-accent)", opacity: 0.85 }}
        />
      )}
      <div className="kicker">{kicker}</div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm text-[var(--color-fg)]/85">{description}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span style={{ color: "var(--color-accent)" }}>✓</span>
            <span className="text-[var(--color-fg)]/90">{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-sm font-semibold" style={{ color: "var(--color-accent)" }}>
        {cta} →
      </div>
    </Link>
  );
}

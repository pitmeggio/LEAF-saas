import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Leaf · Athlete Profiles" };
export const dynamic = "force-dynamic";

// Marketing / explainer surface for "Leaf Profiles".
//
// Athlete profiles are NOT listed here (privacy-first, no feed). Discovery
// of academies + athletes lives at /explore — this page exists to explain
// what a Leaf Profile IS and link athletes to the create-profile flow.
//
// Wired into PublicNav so it stops feeling like an orphan marketing page.
export default async function ProfilesLanding() {
  return (
    <div className="min-h-screen">
      <PublicNav active="athletes" />

      <section className="mx-auto max-w-3xl px-6 py-24 text-center md:px-12">
        <div className="mb-5 inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-muted)]">
          Recruiting portfolios · not social media
        </div>
        <h1 className="text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          The verified home for an athlete&apos;s career.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[var(--color-muted)]">
          Leaf Profiles turn an athlete&apos;s results, ranking and growth into a clean,
          shareable recruiting portfolio — owned by the athlete, verified by their academy.
          Profiles are private by default and shared by link.
        </p>

        <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
          <Feature title="Verified data" body="FIS / ATP-linked results and ranking, confirmed by the academy." />
          <Feature title="Privacy first" body="Every section is opt-in. No feed, no followers, no noise." />
          <Feature title="Built to share" body="One link to a premium portfolio for scouts and federations." />
        </div>

        {/* Clear next steps — instead of the duplicate "academies recruiting"
            block (which lives canonically on /explore), one path for athletes
            and one for academies. /explore handles browsing for everyone. */}
        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          <Link
            href="/login/athlete"
            className="card group flex items-start gap-3 p-5 text-left transition-colors hover:border-[var(--color-accent)]"
          >
            <span className="text-2xl" aria-hidden>🪪</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">I&apos;m an athlete</div>
              <div className="mt-1 text-xs text-[var(--color-muted)]">Sign in to manage your verified profile, or ask your academy to publish one for you.</div>
            </div>
            <span className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)]">→</span>
          </Link>
          <Link
            href="/explore"
            className="card group flex items-start gap-3 p-5 text-left transition-colors hover:border-[var(--color-accent)]"
          >
            <span className="text-2xl" aria-hidden>🔍</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">Browse profiles &amp; academies</div>
              <div className="mt-1 text-xs text-[var(--color-muted)]">Discover verified athletes and high-performance academies currently recruiting.</div>
            </div>
            <span className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)]">→</span>
          </Link>
        </div>

        <p className="mt-10 text-xs text-[var(--color-muted)]">
          Have a profile link? Open it directly. Academies manage profiles from the{" "}
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">Leaf app</Link>.
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1.5 text-sm text-[var(--color-muted)]">{body}</div>
    </div>
  );
}

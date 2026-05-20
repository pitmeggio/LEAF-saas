import Link from "next/link";
import { getRecruitingAcademies } from "@/lib/profiles";
import { AcademyRecruitingCard } from "@/components/Recruiting";

export const metadata = { title: "Leaf · Athlete Profiles" };
export const dynamic = "force-dynamic";

// Athlete profiles are NOT listed here (privacy-first, no feed). The only public
// directory is academies that are actively recruiting — a curated, opt-in surface
// driven by Academy OS recruiting settings.
export default async function ProfilesLanding() {
  const academies = await getRecruitingAcademies();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4 md:px-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg font-black" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>L</div>
          <div className="leading-tight">
            <div className="text-sm font-bold">Leaf Profiles</div>
            <div className="text-[11px] text-[var(--color-muted)]">Verified athlete portfolios</div>
          </div>
        </div>
      </header>

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
        <p className="mt-12 text-xs text-[var(--color-muted)]">
          Have a profile link? Open it directly. Academies manage profiles from the{" "}
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">Leaf app</Link>.
        </p>
      </section>

      {/* Academies recruiting now */}
      {academies.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
          <div className="mb-6 text-center">
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>Applications open</div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Academies recruiting now</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--color-muted)]">
              High-performance academies currently accepting athletes. Explore the program or apply directly.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {academies.map((a) => <AcademyRecruitingCard key={a.slug} a={a} />)}
          </div>
        </section>
      )}
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

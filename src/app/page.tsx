import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";

export const metadata = {
  title: "LEAF — Where athlete performance becomes intelligence",
  description: "The operating system behind elite sports academies — verified athlete performance, analytics, recruiting and academy operations in one intelligent platform.",
};

const DEMO_MAILTO = "mailto:hello@leaf.app?subject=LEAF%20demo%20request";

const PILLS = ["FIS / ATP verified", "Performance analytics", "Recruiting network", "Academy OS"];

export default function LeafLanding() {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-5 py-3.5 backdrop-blur md:px-12">
        <div className="flex items-center gap-2.5">
          <LeafMark size={30} />
          <span className="text-lg font-bold tracking-tight">LEAF</span>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/explore" className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]">Explore</Link>
          <a href={DEMO_MAILTO} className="hidden rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)] sm:inline-block">Request demo</a>
          <Link href="/login" className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#07080b] hover:bg-[var(--color-accent-dim)]">Sign in</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-1/2 top-[-120px] h-[420px] w-[820px] -translate-x-1/2 glow-accent" />
        <div className="relative mx-auto max-w-4xl px-5 py-24 text-center md:px-12 md:py-32">
          <div className="kicker mb-6">AI-powered sports performance OS</div>
          <h1 className="display mx-auto max-w-3xl text-5xl font-bold md:text-7xl">
            Where athlete performance<br className="hidden sm:block" /> becomes <span className="text-gradient">intelligence</span>.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-[var(--color-muted)] md:text-lg">
            LEAF is the operating system behind elite sports academies — verified athlete data,
            performance analytics, recruiting and academy operations, unified in one intelligent platform.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={DEMO_MAILTO} className="w-full rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#07080b] hover:bg-[var(--color-accent-dim)] sm:w-auto">
              Request a demo →
            </a>
            <Link href="/explore" className="w-full rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-medium hover:bg-[var(--color-surface)] sm:w-auto">
              Explore athletes
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {PILLS.map((p) => (
              <span key={p} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-3.5 py-1.5 text-xs text-[var(--color-muted)]">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Two layers */}
      <section className="mx-auto max-w-5xl px-5 pb-16 md:px-12">
        <div className="grid gap-5 md:grid-cols-2">
          <Layer
            kicker="Public — Athlete Layer"
            title="Performance, verified."
            points={["FIS / ATP-linked results & ranking", "Growth trend & deep analytics", "Verified, shareable athlete profile", "Recruiting visibility for scouts"]}
          />
          <Layer
            kicker="Private — Academy OS"
            title="Run the program."
            points={["Applications, admissions & enrollments", "Athletes, coaches, groups & packages", "Payments, invoices, budgets & reports", "Documents, automation & messaging"]}
          />
        </div>
        <p className="mt-6 text-center text-xs text-[var(--color-muted)]">One source of truth. The dashboard controls exactly what becomes public.</p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-5 pb-28 text-center md:px-12">
        <div className="card relative overflow-hidden p-12">
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
          <div className="relative">
            <h2 className="display text-3xl font-bold">Built for elite performance.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-muted)]">A tailored walkthrough with your academy&apos;s athletes and data.</p>
            <a href={DEMO_MAILTO} className="mt-6 inline-block rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#07080b] hover:bg-[var(--color-accent-dim)]">
              Request a demo
            </a>
          </div>
        </div>
      </section>

      <footer className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-6 text-xs text-[var(--color-muted)] md:px-12">
        <div className="flex items-center gap-2"><LeafMark size={18} variant="currentColor" /> <span>LEAF</span></div>
        <span>Sports Performance OS</span>
      </footer>
    </div>
  );
}

function Layer({ kicker, title, points }: { kicker: string; title: string; points: string[] }) {
  return (
    <div className="card p-7">
      <div className="kicker" style={{ color: "var(--color-accent)" }}>{kicker}</div>
      <h2 className="mt-2.5 text-xl font-bold tracking-tight">{title}</h2>
      <ul className="mt-5 space-y-3 text-sm">
        {points.map((p) => (
          <li key={p} className="flex gap-3 text-[var(--color-fg)]/90">
            <span className="num text-xs text-[var(--color-accent)]">›</span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

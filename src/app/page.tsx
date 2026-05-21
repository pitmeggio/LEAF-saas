import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";

export const metadata = {
  title: "Leaf — the operating system for sports academies",
  description: "Leaf runs your academy and powers verified public athlete profiles and recruiting.",
};

const DEMO_MAILTO = "mailto:hello@leaf.app?subject=Leaf%20demo%20request";

export default function LeafLanding() {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-5 py-3.5 backdrop-blur md:px-12">
        <div className="flex items-center gap-2.5">
          <LeafMark size={30} />
          <span className="text-lg font-bold tracking-tight">LEAF</span>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/explore" className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]">Explore</Link>
          <a href={DEMO_MAILTO} className="hidden rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)] sm:inline-block">Request demo</a>
          <Link href="/login" className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">Sign in</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-5 py-24 text-center md:px-12 md:py-32">
        <div className="mb-5 inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-muted)]">
          Academy management + verified athlete profiles
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          The operating system for high-performance sports academies.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--color-muted)] md:text-lg">
          Leaf runs the private side of your academy — applications, athletes, payments and coaching —
          and powers a public side with verified athlete profiles and open recruiting. One platform, one source of truth.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={DEMO_MAILTO} className="w-full rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] sm:w-auto">
            Request a demo →
          </a>
          <Link href="/login" className="w-full rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-medium hover:bg-[var(--color-surface)] sm:w-auto">
            Sign in
          </Link>
        </div>
      </section>

      {/* Two sides */}
      <section className="mx-auto max-w-5xl px-5 pb-24 md:px-12">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card p-7">
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>Private — Academy OS</div>
            <h2 className="mt-2 text-xl font-bold">Run the academy</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--color-fg)]/90">
              {["Applications pipeline & enrollments", "Athletes, coaches, groups & packages", "Payments, invoices & budgets", "Documents, alerts & messaging"].map((f) => (
                <li key={f} className="flex gap-2.5"><span style={{ color: "var(--color-accent)" }}>›</span>{f}</li>
              ))}
            </ul>
          </div>
          <div className="card p-7">
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-accent)" }}>Public — Leaf Profiles</div>
            <h2 className="mt-2 text-xl font-bold">Show the talent</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--color-fg)]/90">
              {["Academy public landing page", "Verified athlete profiles with stats & results", "Open applications & recruiting status", "Application form for athletes"].map((f) => (
                <li key={f} className="flex gap-2.5"><span style={{ color: "var(--color-accent)" }}>›</span>{f}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-[var(--color-muted)]">The dashboard controls exactly what appears publicly.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-5 pb-28 text-center md:px-12">
        <div className="card flex flex-col items-center gap-4 p-10">
          <h2 className="text-2xl font-bold">See Leaf with your academy&apos;s data.</h2>
          <p className="max-w-md text-sm text-[var(--color-muted)]">
            We&apos;ll set up a tailored walkthrough for your program and athletes.
          </p>
          <a href={DEMO_MAILTO} className="rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
            Request a demo
          </a>
        </div>
      </section>

      <footer className="border-t border-[var(--color-border)] px-5 py-6 text-center text-xs text-[var(--color-muted)] md:px-12">
        Leaf · Academy OS + Athlete Profiles
      </footer>
    </div>
  );
}

import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";
import { PublicNav } from "@/components/PublicNav";

export const metadata = {
  title: "LEAF — Where athlete performance becomes intelligence",
  description: "The operating system behind elite sports academies — verified athlete performance, analytics, recruiting and academy operations in one intelligent platform.",
};

const PILLS = ["FIS / ATP verified", "Performance analytics", "Recruiting network", "Academy OS"];

export default function LeafLanding() {
  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* Hero — what LEAF is */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-1/2 top-[-120px] h-[420px] w-[820px] -translate-x-1/2 glow-accent" />
        <div className="pointer-events-none absolute right-[6%] top-[40px] h-[300px] w-[420px] glow-accent-2" />
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
            <Link href="/explore" className="w-full rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#07080b] hover:bg-[var(--color-accent-dim)] sm:w-auto">
              I'm an athlete →
            </Link>
            <Link href="/request" className="w-full rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-medium hover:bg-[var(--color-surface)] sm:w-auto">
              I run an academy
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {PILLS.map((p) => (
              <span key={p} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-3.5 py-1.5 text-xs text-[var(--color-muted)]">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Two audiences — pick your path */}
      <section className="mx-auto max-w-5xl px-5 pb-16 md:px-12">
        <div className="mb-6 text-center">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>One platform, two sides</div>
          <h2 className="display mt-1 text-2xl font-bold md:text-3xl">Where do you fit?</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Layer
            href="/explore"
            kicker="For athletes"
            title="Your performance, verified."
            cta="Create your profile →"
            points={["FIS / ATP-linked results & ranking", "Growth trend & deep analytics", "Verified, shareable athlete profile", "Recruiting visibility for scouts"]}
          />
          <Layer
            href="/request"
            kicker="For academies"
            title="Run the whole program."
            cta="Bring your academy →"
            points={["Applications, admissions & enrollments", "Athletes, coaches, groups & packages", "Payments, invoices, budgets & reports", "Documents, automation & messaging"]}
          />
        </div>
        <p className="mt-6 text-center text-xs text-[var(--color-muted)]">One source of truth. The dashboard controls exactly what becomes public.</p>
      </section>

      <footer className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-6 text-xs text-[var(--color-muted)] md:px-12">
        <div className="flex items-center gap-2"><LeafMark size={18} variant="currentColor" /> <span>LEAF</span></div>
        <span>Sports Performance OS</span>
      </footer>
    </div>
  );
}

function Layer({ href, kicker, title, cta, points }: { href: string; kicker: string; title: string; cta: string; points: string[] }) {
  return (
    <Link href={href} className="card group p-7 transition-all hover:-translate-y-0.5 hover:border-[var(--color-accent)]">
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
      <div className="mt-6 text-sm font-semibold text-[var(--color-accent)]">{cta}</div>
    </Link>
  );
}

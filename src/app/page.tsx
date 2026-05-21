import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductPreview } from "@/components/ProductPreview";

export const metadata = {
  title: "LEAF — The verified performance intelligence layer for elite sport",
  description: "Verified athlete profiles, AI performance analytics and the operating system elite academies run on.",
};

export default function LeafLanding() {
  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-1/2 top-[-140px] h-[460px] w-[860px] -translate-x-1/2 glow-accent" />
        <div className="relative mx-auto max-w-4xl px-5 pt-28 text-center md:px-12 md:pt-36">
          <div className="kicker mb-6">Sports performance OS</div>
          <h1 className="display mx-auto max-w-3xl text-balance text-5xl font-bold leading-[1.02] md:text-7xl">
            Where performance becomes <span className="text-gradient">intelligence</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-[var(--color-muted)] md:text-xl">
            Verified athlete data, AI analytics, and the operating system elite academies run on.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/explore" className="rounded-full bg-[var(--color-accent)] px-7 py-3 text-sm font-semibold text-[#07080b] hover:bg-[var(--color-accent-dim)]">I&apos;m an athlete</Link>
            <Link href="/request" className="rounded-full border border-[var(--color-border)] px-7 py-3 text-sm font-medium hover:border-[var(--color-accent)]">I run an academy</Link>
          </div>
        </div>
        <div className="relative px-5 pb-28 pt-16 md:px-12 md:pb-36">
          <ProductPreview />
        </div>
      </section>

      {/* Verified */}
      <Statement
        kicker="Verified"
        title={<>Real data.<br />Not self-reported.</>}
        sub="Every profile is built from official, federation-published results — FIS, ATP and more. Numbers you can trust, for decisions that matter."
      />

      {/* AI */}
      <section className="border-t border-[var(--color-border)] py-28 md:py-36">
        <div className="mx-auto max-w-4xl px-5 text-center md:px-12">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>The intelligence layer</div>
          <h2 className="display mx-auto mt-3 max-w-2xl text-balance text-4xl font-bold md:text-6xl">AI that does the thinking.</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--color-muted)]">
            It reads the trend, the consistency and the risk — then tells you what it means. It suggests; you decide.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-4xl gap-10 px-5 text-center md:grid-cols-3 md:px-12">
          {AI.map((a) => (
            <div key={a.title}>
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl text-lg" style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}>{a.icon}</div>
              <h3 className="mt-4 text-lg font-semibold">{a.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Academy OS */}
      <Statement
        kicker="Academy OS"
        title={<>Run the whole academy.</>}
        sub="Admissions, athletes, attendance, finance and contracts — in one place, with AI catching whatever slips. Less admin. Nothing missed."
        footer={<div className="mt-8 flex flex-wrap justify-center gap-2.5">{OS_TAGS.map((t) => (<span key={t} className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-sm text-[var(--color-muted)]">{t}</span>))}</div>}
      />

      {/* Two sides */}
      <section className="border-t border-[var(--color-border)] py-28 md:py-36">
        <div className="mx-auto max-w-4xl px-5 text-center md:px-12">
          <h2 className="display text-balance text-4xl font-bold md:text-6xl">Two sides. One platform.</h2>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 px-5 md:grid-cols-2 md:px-12">
          <Side href="/explore" kicker="For athletes" title="Own your performance." desc="A verified profile with AI insights and forecast — the one link you send to academies and scouts." cta="Create your profile" />
          <Side href="/request" kicker="For academies" title="Run elite programs." desc="From application to active athlete — recruiting, operations and finance, with intelligence on top." cta="Bring your academy" />
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[var(--color-border)]">
        <div className="relative mx-auto max-w-3xl overflow-hidden px-5 py-28 text-center md:px-12 md:py-36">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[560px] -translate-x-1/2 -translate-y-1/2 glow-accent" />
          <div className="relative">
            <h2 className="display text-balance text-4xl font-bold md:text-6xl">Start with one code.</h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-[var(--color-muted)]">Your verified profile builds itself. Free, and yours to keep.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/explore" className="rounded-full bg-[var(--color-accent)] px-7 py-3 text-sm font-semibold text-[#07080b] hover:bg-[var(--color-accent-dim)]">Create your profile</Link>
              <Link href="/request" className="rounded-full border border-[var(--color-border)] px-7 py-3 text-sm font-medium hover:border-[var(--color-accent)]">Bring your academy</Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

const AI = [
  { icon: "↗", title: "Insights", desc: "Strengths, weak areas and consistency — read from the record, in plain language." },
  { icon: "◎", title: "Forecast", desc: "Projected ranking, momentum and regression risk on the current trajectory." },
  { icon: "✦", title: "Recommendations", desc: "What to work on next — and which group, applicant or athlete needs attention." },
];

const OS_TAGS = ["Admissions", "Athletes", "Attendance", "Finance", "Contracts", "Smart alerts"];

function Statement({ kicker, title, sub, footer }: { kicker: string; title: React.ReactNode; sub: string; footer?: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--color-border)] py-28 md:py-36">
      <div className="mx-auto max-w-4xl px-5 text-center md:px-12">
        <div className="kicker" style={{ color: "var(--color-accent)" }}>{kicker}</div>
        <h2 className="display mx-auto mt-3 max-w-2xl text-balance text-4xl font-bold leading-[1.05] md:text-6xl">{title}</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--color-muted)]">{sub}</p>
        {footer}
      </div>
    </section>
  );
}

function Side({ href, kicker, title, desc, cta }: { href: string; kicker: string; title: string; desc: string; cta: string }) {
  return (
    <Link href={href} className="card group p-8 transition-colors hover:border-[var(--color-accent)]">
      <div className="kicker" style={{ color: "var(--color-accent)" }}>{kicker}</div>
      <h3 className="display mt-2 text-2xl font-bold md:text-3xl">{title}</h3>
      <p className="mt-3 text-base leading-relaxed text-[var(--color-muted)]">{desc}</p>
      <div className="mt-6 text-sm font-semibold text-[var(--color-accent)]">{cta} →</div>
    </Link>
  );
}

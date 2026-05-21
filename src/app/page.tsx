import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "LEAF — The verified performance intelligence layer for elite sport",
  description: "LEAF turns official federation data into performance intelligence — verified athlete profiles, AI analytics and the operating system elite academies run on.",
};

const PILLS = ["FIS-verified data", "AI performance intelligence", "Recruiting network", "Academy OS"];

const FLYWHEEL = [
  { n: "01", title: "Athletes build verified profiles", desc: "From their federation code, LEAF imports official results and builds a verified, AI-analysed profile they own." },
  { n: "02", title: "Academies discover & run programs", desc: "Academies recruit from verified profiles, then run admissions, athletes, attendance, finance — all in one OS." },
  { n: "03", title: "Intelligence compounds", desc: "Every result, session and outcome feeds the model — sharper insights, deeper moat, season after season." },
];

const AI = [
  { tag: "Athlete AI", title: "Performance forecast", desc: "Projected ranking, progression and regression risk from the trajectory." },
  { tag: "Athlete AI", title: "Insights & recommendations", desc: "Strengths, weak areas and what to work on next — in plain language." },
  { tag: "Academy AI", title: "Smart group assignment", desc: "Suggests the right team for each applicant, with the reasons — coach decides." },
  { tag: "Academy AI", title: "Fit score & risk flags", desc: "Scores every application and surfaces the risks before you decide." },
  { tag: "Academy AI", title: "Academy health", desc: "Revenue, occupancy and retention read from live data the moment you log in." },
  { tag: "Academy AI", title: "Smart alerts", desc: "Overdue fees, expiring contracts and attendance anomalies — caught automatically." },
];

const MISSION = [
  { title: "Verified, not self-reported", desc: "Every metric is built from official, federation-published results — FIS today, ATP and more next." },
  { title: "Owned by the athlete", desc: "Your performance, your link, your call on who sees it. No public roster to scroll." },
  { title: "An intelligence layer, not a chatbot", desc: "AI works across grouping, performance and operations — explainable, every time." },
];

export default function LeafLanding() {
  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-1/2 top-[-120px] h-[420px] w-[820px] -translate-x-1/2 glow-accent" />
        <div className="pointer-events-none absolute right-[6%] top-[40px] h-[300px] w-[420px] glow-accent-2" />
        <div className="relative mx-auto max-w-4xl px-5 py-24 text-center md:px-12 md:py-32">
          <div className="kicker mb-6">The verified performance intelligence layer</div>
          <h1 className="display mx-auto max-w-3xl text-5xl font-bold md:text-7xl">
            Where athlete performance<br className="hidden sm:block" /> becomes <span className="text-gradient">intelligence</span>.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-[var(--color-muted)] md:text-lg">
            LEAF turns official federation data into performance intelligence — verified athlete profiles,
            AI analytics, and the operating system elite academies run on.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/explore" className="w-full rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#07080b] hover:bg-[var(--color-accent-dim)] sm:w-auto">
              I&apos;m an athlete →
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

      {/* Thesis */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/30">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center md:px-12">
          <div className="kicker mb-3" style={{ color: "var(--color-accent)" }}>Why LEAF</div>
          <p className="display mx-auto max-w-3xl text-2xl font-semibold leading-snug md:text-3xl">
            Elite sport runs on data locked in federation databases and spreadsheets.
            LEAF turns it into <span className="text-gradient">intelligence</span> — so athletes own their story and academies run world-class programs.
          </p>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {MISSION.map((m) => (
              <div key={m.title} className="card p-5 text-left">
                <div className="text-sm font-semibold">{m.title}</div>
                <div className="mt-1.5 text-sm text-[var(--color-muted)]">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The flywheel */}
      <section className="mx-auto max-w-5xl px-5 py-20 md:px-12">
        <div className="mb-10 text-center">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>How it works</div>
          <h2 className="display mt-1 text-3xl font-bold md:text-4xl">One platform, two sides, one flywheel.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {FLYWHEEL.map((s) => (
            <div key={s.n} className="relative">
              <div className="num text-5xl font-bold text-[var(--color-border)]">{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The intelligence layer */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/30">
        <div className="mx-auto max-w-5xl px-5 py-20 md:px-12">
          <div className="mb-10 max-w-2xl">
            <div className="kicker" style={{ color: "var(--color-accent)" }}>The intelligence layer</div>
            <h2 className="display mt-1 text-3xl font-bold md:text-4xl">AI that does the thinking — and shows its work.</h2>
            <p className="mt-3 text-base text-[var(--color-muted)]">Across both sides of LEAF, the AI suggests, scores and forecasts. It never auto-decides, and every output is explainable.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AI.map((a) => (
              <div key={a.title} className="card p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{a.tag}</span>
                </div>
                <h3 className="mt-2 text-base font-semibold">{a.title}</h3>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two audiences */}
      <section className="mx-auto max-w-5xl px-5 py-20 md:px-12">
        <div className="mb-8 text-center">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>Where do you fit?</div>
          <h2 className="display mt-1 text-3xl font-bold md:text-4xl">Pick your side.</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Layer
            href="/explore"
            kicker="For athletes"
            title="Your performance, verified."
            cta="Create your profile →"
            points={["Federation-linked results & ranking", "Growth trend, forecast & deep analytics", "Verified, shareable profile you own", "Recruiting visibility for academies"]}
          />
          <Layer
            href="/request"
            kicker="For academies"
            title="Run the whole program."
            cta="Bring your academy →"
            points={["Admissions with AI fit score & grouping", "Athletes, coaches, groups, attendance", "Payments, contracts, budgets & reports", "Academy health & smart alerts"]}
          />
        </div>
      </section>

      {/* Credibility / data band */}
      <section className="border-t border-[var(--color-border)]">
        <div className="relative mx-auto max-w-4xl overflow-hidden px-5 py-20 text-center md:px-12">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[520px] -translate-x-1/2 -translate-y-1/2 glow-accent" />
          <div className="relative">
            <div className="kicker mb-3" style={{ color: "var(--color-accent)" }}>Built on verified data</div>
            <h2 className="display text-3xl font-bold md:text-4xl">Real results. Real intelligence.</h2>
            <p className="mx-auto mt-3 max-w-md text-base text-[var(--color-muted)]">
              Starting with alpine skiing and live FIS data — built to scale to tennis, cycling and beyond.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/explore" className="w-full rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#07080b] hover:bg-[var(--color-accent-dim)] sm:w-auto">Create your profile</Link>
              <Link href="/request" className="w-full rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-medium hover:bg-[var(--color-surface)] sm:w-auto">Bring your academy</Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
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

import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "LEAF — The verified performance intelligence layer for elite sport",
  description: "Verified athlete profiles, AI performance analytics and the operating system elite academies run on.",
};

const PILLS = ["FIS-verified data", "AI performance intelligence", "Recruiting network", "Academy OS"];

const MISSION = [
  { title: "Verified, not self-reported", desc: "Every metric is built from official, federation-published results — FIS today, ATP and more next." },
  { title: "Owned by the athlete", desc: "Your performance, your link, your call on who sees it. No public roster to scroll." },
  { title: "Intelligence, not a chatbot", desc: "AI works across grouping, performance and operations — explainable, every time." },
];

const AI = [
  { tag: "Athlete AI", title: "Performance forecast", desc: "Projected ranking, momentum and regression risk on the current trajectory." },
  { tag: "Athlete AI", title: "Insights & recommendations", desc: "Strengths, weak areas and what to work on next — in plain language." },
  { tag: "Athlete AI", title: "Verified profile", desc: "Federation-linked results, ranking and trend — one link you own." },
  { tag: "Academy AI", title: "Smart group assignment", desc: "Suggests the right team for each applicant, with the reasons. Coach decides." },
  { tag: "Academy AI", title: "Fit score & risk flags", desc: "Scores every application and surfaces the risks before you decide." },
  { tag: "Academy AI", title: "Health & smart alerts", desc: "Revenue, occupancy, retention — plus overdue, contract and attendance alerts." },
];

const FLYWHEEL = [
  { n: "01", title: "Athletes build verified profiles", desc: "From a federation code, LEAF imports official results and builds an AI-analysed profile they own." },
  { n: "02", title: "Academies discover & run programs", desc: "Recruit from verified profiles, then run admissions, athletes, finance — all in one OS." },
  { n: "03", title: "Intelligence compounds", desc: "Every result, session and outcome sharpens the model — season after season." },
];

export default function LeafLanding() {
  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-1/2 top-[-140px] h-[460px] w-[860px] -translate-x-1/2 glow-accent" />
        <div className="relative mx-auto max-w-4xl px-5 py-28 text-center md:px-12 md:py-36">
          <div className="kicker mb-6">Sports performance OS</div>
          <h1 className="display mx-auto max-w-3xl text-balance text-5xl font-bold leading-[1.02] md:text-7xl">
            Where athlete performance becomes <span className="text-gradient">intelligence</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-[var(--color-muted)] md:text-xl">
            Verified athlete data, AI analytics, and the operating system elite academies run on.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/explore" className="rounded-full bg-[var(--color-accent)] px-7 py-3 text-sm font-semibold text-[#07080b] hover:bg-[var(--color-accent-dim)]">I&apos;m an athlete</Link>
            <Link href="/request" className="rounded-full border border-[var(--color-border)] px-7 py-3 text-sm font-medium hover:border-[var(--color-accent)]">I run an academy</Link>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
            {PILLS.map((p) => (
              <span key={p} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-3.5 py-1.5 text-xs text-[var(--color-muted)]">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Why LEAF */}
      <section className="border-t border-[var(--color-border)] py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-5 text-center md:px-12">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>Why LEAF</div>
          <h2 className="display mx-auto mt-3 max-w-2xl text-balance text-3xl font-bold leading-[1.08] md:text-5xl">
            Elite sport runs on data locked in databases. LEAF turns it into intelligence.
          </h2>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-5 px-5 md:grid-cols-3 md:px-12">
          {MISSION.map((m) => (
            <div key={m.title} className="card pop p-6">
              <h3 className="text-base font-semibold">{m.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI */}
      <section className="border-t border-[var(--color-border)] py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-5 text-center md:px-12">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>The intelligence layer</div>
          <h2 className="display mx-auto mt-3 max-w-2xl text-balance text-4xl font-bold md:text-6xl">AI that does the thinking.</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--color-muted)]">It suggests, scores and forecasts across both sides — and shows its work, every time.</p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-4 px-5 sm:grid-cols-2 lg:grid-cols-3 md:px-12">
          {AI.map((a) => (
            <div key={a.title} className="card pop p-6 text-left">
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{a.tag}</span>
              </div>
              <h3 className="mt-2 text-base font-semibold">{a.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[var(--color-border)] py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-5 text-center md:px-12">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>How it works</div>
          <h2 className="display mx-auto mt-3 max-w-2xl text-balance text-4xl font-bold md:text-6xl">One platform, two sides, one flywheel.</h2>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-8 px-5 md:grid-cols-3 md:px-12">
          {FLYWHEEL.map((s) => (
            <div key={s.n}>
              <div className="num text-5xl font-bold text-[var(--color-border)]">{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Two sides */}
      <section className="border-t border-[var(--color-border)] py-24 md:py-32">
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

function Side({ href, kicker, title, desc, cta }: { href: string; kicker: string; title: string; desc: string; cta: string }) {
  return (
    <Link href={href} className="card pop p-8">
      <div className="kicker" style={{ color: "var(--color-accent)" }}>{kicker}</div>
      <h3 className="display mt-2 text-2xl font-bold md:text-3xl">{title}</h3>
      <p className="mt-3 text-base leading-relaxed text-[var(--color-muted)]">{desc}</p>
      <div className="mt-6 text-sm font-semibold text-[var(--color-accent)]">{cta} →</div>
    </Link>
  );
}

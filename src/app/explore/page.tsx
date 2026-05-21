import { PublicNav } from "@/components/PublicNav";
import { CreateProfileButton } from "@/components/CreateProfilePanel";

export const metadata = { title: "Your performance, analyzed — LEAF" };

// What LEAF computes from an athlete's FIS-published record.
const ANALYSIS = [
  { metric: "FIS points trend", desc: "Your points trajectory over the season — the single clearest signal of where your level is heading.", icon: "↘" },
  { metric: "World rank movement", desc: "How your standing shifts race by race, so progress is measured against the field, not just yourself.", icon: "#" },
  { metric: "Consistency score", desc: "How reliably you perform near your best — the trait coaches and selectors weight most.", icon: "≈" },
  { metric: "Discipline split", desc: "Where your results actually come from across SL, GS, SG and DH — your real strengths, quantified.", icon: "◖" },
  { metric: "Podium & top-10 rate", desc: "Conversion into results that matter, normalised by how often you start.", icon: "▲" },
  { metric: "DNF / finish rate", desc: "Risk and reliability under pressure — the part of your record a points list never shows.", icon: "✕" },
];

const STEPS = [
  { n: "01", title: "Enter your FIS code", desc: "Your name and FIS code — nothing else. We find your published record." },
  { n: "02", title: "We import & analyze", desc: "Results, points history and rankings are pulled and turned into a performance picture." },
  { n: "03", title: "Share your profile", desc: "Get one verified link to send to academies, coaches and selectors. You decide what's visible." },
];

export default function ExplorePage() {
  return (
    <div className="min-h-screen">
      <PublicNav active="athletes" />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-1/2 top-[-120px] h-[340px] w-[600px] -translate-x-1/2 glow-accent" />
        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center md:px-12 md:py-28">
          <div className="kicker mb-4" style={{ color: "var(--color-accent)" }}>For athletes</div>
          <h1 className="display mx-auto max-w-3xl text-4xl font-bold leading-[1.05] md:text-6xl">
            Your performance,<br /><span className="text-gradient">turned into intelligence.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[var(--color-muted)] md:text-lg">
            LEAF reads your FIS-published record and builds a verified performance profile — trends, consistency and the analysis academies actually look for. One link, owned by you.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <CreateProfileButton />
            <a href="#how" className="rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold hover:border-[var(--color-accent)]">
              How it works
            </a>
          </div>
          <p className="mt-5 text-xs text-[var(--color-muted)]">Free to create · Verified from FIS data · Private until you share</p>
        </div>
      </section>

      {/* What we analyze */}
      <section className="mx-auto max-w-5xl px-5 py-20 md:px-12">
        <div className="mb-12 max-w-2xl">
          <div className="kicker mb-2" style={{ color: "var(--color-accent)" }}>What we analyze</div>
          <h2 className="display text-3xl font-bold md:text-4xl">Everything a points list leaves out.</h2>
          <p className="mt-3 text-base text-[var(--color-muted)]">
            A FIS number tells you where you stand today. LEAF tells you where you're going, how reliably you get there, and what your record really says about you.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ANALYSIS.map((a) => (
            <div key={a.metric} className="card group p-6 transition-colors hover:border-[var(--color-accent)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold" style={{ background: "var(--color-surface-2)", color: "var(--color-accent)" }}>
                {a.icon}
              </div>
              <h3 className="mt-4 text-base font-semibold">{a.metric}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/30">
        <div className="mx-auto max-w-5xl px-5 py-20 md:px-12">
          <div className="mb-12 max-w-2xl">
            <div className="kicker mb-2" style={{ color: "var(--color-accent)" }}>How it works</div>
            <h2 className="display text-3xl font-bold md:text-4xl">From FIS code to verified profile in seconds.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <div className="num text-5xl font-bold text-[var(--color-border)]">{s.n}</div>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy / ownership */}
      <section className="mx-auto max-w-5xl px-5 py-20 md:px-12">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="kicker mb-2" style={{ color: "var(--color-accent)" }}>Your profile, your rules</div>
            <h2 className="display text-3xl font-bold md:text-4xl">Private by default. Visible only when you choose.</h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--color-muted)]">
              LEAF isn't a public database of athletes to scroll through. There's no directory exposing everyone. Your profile lives behind a link you own — share it with the academy or coach you want, and revoke it any time.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              ["Owned by you", "Your data, your link, your call on who sees it."],
              ["Verified, not self-reported", "Built from FIS-published competition data."],
              ["No public roster", "Athletes can't browse other athletes here."],
            ].map(([t, d]) => (
              <div key={t} className="card flex items-start gap-3 p-5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: "#7cff6b1a", color: "var(--color-accent)" }}>✓</span>
                <div>
                  <div className="text-sm font-semibold">{t}</div>
                  <div className="mt-0.5 text-sm text-[var(--color-muted)]">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--color-border)]">
        <div className="relative mx-auto max-w-4xl overflow-hidden px-5 py-20 text-center md:px-12">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 glow-accent" />
          <div className="relative">
            <h2 className="display text-3xl font-bold md:text-4xl">Build your verified profile.</h2>
            <p className="mx-auto mt-3 max-w-md text-base text-[var(--color-muted)]">
              It takes one FIS code. Free, and yours to keep.
            </p>
            <div className="mt-8 flex justify-center">
              <CreateProfileButton />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--color-border)] px-5 py-6 text-center text-xs text-[var(--color-muted)] md:px-12">
        Powered by LEAF · Verified athlete profiles
      </footer>
    </div>
  );
}

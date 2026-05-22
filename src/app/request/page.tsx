import { PublicNav } from "@/components/PublicNav";
import { RequestAcademyForm } from "@/components/RequestAcademyForm";
import { SiteFooter } from "@/components/SiteFooter";
import { PLANS } from "@/lib/plans";

export const metadata = { title: "Bring your academy to LEAF" };

const MODULES = [
  { tag: "Admissions", title: "Admissions on autopilot", desc: "Athletes apply with a verified profile via “Apply with LEAF”. Every application arrives with an AI fit score, risk flags and a suggested group — no forms to triage." },
  { tag: "Athletes", title: "Athlete management", desc: "The whole roster — profiles, groups, levels, status and notes — with verified federation performance data attached to each athlete." },
  { tag: "Daily ops", title: "Attendance", desc: "Take attendance per session by group, track each athlete’s attendance rate, and get flagged automatically when it drops." },
  { tag: "Finance", title: "Finance & contracts", desc: "Packages, invoices and payment tracking, plus contracts with renewal reminders and automatic overdue alerts." },
  { tag: "Operations", title: "Documents & imports", desc: "Required-document checklists, bulk athlete import from a spreadsheet, waivers and academy files in one place." },
  { tag: "Academy AI", title: "Academy intelligence", desc: "Revenue, occupancy and retention read from live data — plus a daily briefing of exactly what needs a human." },
];

const WORKFLOW = [
  { n: "01", title: "Open your spots", desc: "Publish programs and openings, and add the “Apply with LEAF” button to your own website." },
  { n: "02", title: "Receive & review", desc: "Applications land verified, scored and group-matched. Accept, waitlist or reject in a click." },
  { n: "03", title: "Convert to athlete", desc: "Acceptance auto-creates the enrollment, payment schedule and document checklist." },
  { n: "04", title: "Run the program", desc: "Attendance, finance, contracts and messaging — with AI alerts catching whatever slips." },
];

export default function RequestAcademyPage() {
  return (
    <div className="min-h-screen">
      <PublicNav active="academies" />
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-1/2 top-[-120px] h-[320px] w-[560px] -translate-x-1/2 glow-accent" />
        <div className="relative mx-auto max-w-3xl px-5 py-16 text-center md:px-12">
          <div className="kicker mb-3" style={{ color: "var(--color-accent)" }}>For academies</div>
          <h1 className="display text-4xl font-bold leading-[1.05] md:text-5xl">Bring your academy to LEAF</h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-[var(--color-muted)]">
            The operating system for elite sports academies — athletes, recruiting, finance and performance intelligence in one place. Request access and we'll set up your workspace.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#request" className="rounded-full bg-[var(--color-accent)] px-7 py-3 text-sm font-semibold text-[#07080b] hover:bg-[var(--color-accent-dim)]">Request access</a>
            <a href="#how" className="rounded-full border border-[var(--color-border)] px-7 py-3 text-sm font-medium hover:border-[var(--color-accent)]">See what you get</a>
          </div>
        </div>
      </section>

      {/* What the Academy OS does */}
      <section id="how" className="mx-auto max-w-5xl px-5 py-16 md:px-12">
        <div className="mb-10 max-w-2xl">
          <div className="kicker" style={{ color: "var(--color-accent)" }}>The Academy OS</div>
          <h2 className="display mt-1 text-3xl font-bold md:text-4xl">Run the whole academy from one place.</h2>
          <p className="mt-3 text-base text-[var(--color-muted)]">
            From the first application to the day-to-day — admissions, athletes, attendance, finance and contracts,
            with an AI layer working across all of it. Less admin, fewer spreadsheets, nothing slipping through.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <div key={m.title} className="card pop p-6">
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-accent)]">{m.tag}</div>
              <h3 className="mt-1.5 text-base font-semibold">{m.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/30">
        <div className="mx-auto max-w-5xl px-5 py-16 md:px-12">
          <div className="mb-10 max-w-2xl">
            <div className="kicker" style={{ color: "var(--color-accent)" }}>How it flows</div>
            <h2 className="display mt-1 text-3xl font-bold md:text-4xl">From application to active athlete — automatically.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            {WORKFLOW.map((s) => (
              <div key={s.n}>
                <div className="num text-4xl font-bold text-[var(--color-border)]">{s.n}</div>
                <h3 className="mt-2 text-base font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI band */}
      <section className="mx-auto max-w-4xl px-5 py-16 text-center md:px-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1">
          <span className="flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
          <span className="text-xs text-[var(--color-muted)]">Academy AI</span>
        </div>
        <h2 className="display mt-4 text-2xl font-bold md:text-3xl">It feels like you do nothing — LEAF does the thinking.</h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-[var(--color-muted)]">
          Smart group assignment, application fit scores, attendance and contract alerts, and a live read on revenue,
          occupancy and retention. The AI suggests and flags — you stay in control of every decision.
        </p>
      </section>

      <div id="request" className="mx-auto grid max-w-5xl gap-10 px-5 py-16 md:grid-cols-[1fr_1.1fr] md:px-12">
        {/* Plans */}
        <div>
          <div className="kicker mb-3" style={{ color: "var(--color-accent)" }}>Plans</div>
          <div className="space-y-3">
            {Object.values(PLANS).map((p) => (
              <div key={p.key} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.label}</span>
                  <span className="text-xs text-[var(--color-muted)]">{p.maxAthletes == null ? "Unlimited athletes" : `Up to ${p.maxAthletes} athletes`}</span>
                </div>
                <p className="mt-1.5 text-sm text-[var(--color-muted)]">{p.blurb}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(p.features).filter(([, on]) => on).map(([k]) => (
                    <span key={k} className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                      {k.replace("feature", "").replace(/([A-Z])/g, " $1").trim()}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Request form */}
        <div>
          <div className="kicker mb-3" style={{ color: "var(--color-accent)" }}>Request access</div>
          <RequestAcademyForm />
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

import { PublicNav } from "@/components/PublicNav";
import { RequestAcademyForm } from "@/components/RequestAcademyForm";
import { PLANS } from "@/lib/plans";

export const metadata = { title: "Bring your academy to LEAF" };

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
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-14 md:grid-cols-[1fr_1.1fr] md:px-12">
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

      <footer className="border-t border-[var(--color-border)] px-5 py-6 text-center text-xs text-[var(--color-muted)] md:px-12">
        Powered by LEAF
      </footer>
    </div>
  );
}

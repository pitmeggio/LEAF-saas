import { PublicNav } from "@/components/PublicNav";

export const metadata = { title: "Privacy & data terms — LEAF" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <div className="mx-auto max-w-2xl px-5 py-16 md:px-12">
        <h1 className="display text-3xl font-bold md:text-4xl">Privacy &amp; data terms</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">How LEAF handles athlete data. (Draft — to be finalised with legal counsel before public launch.)</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--color-fg)]/85">
          <Section title="What we process">
            LEAF builds an athlete profile from <strong>publicly-published competition data</strong> (e.g. FIS points lists,
            ATP rankings) plus the details you provide (name, email, contact). We process it to create your verified
            profile, performance analytics and applications you choose to send.
          </Section>
          <Section title="Your control">
            Your profile is yours. You decide what is visible and who can see your link, and you can hide or delete it at
            any time. We do not sell your data, and there is no public roster of athletes to browse.
          </Section>
          <Section title="Minors">
            If the athlete is under 18, a parent or guardian must give consent. Guardian contact details are collected on
            the application and used only for academy communication.
          </Section>
          <Section title="Legal basis & rights">
            We rely on your consent and our legitimate interest in providing the service. You can request access,
            correction or deletion of your data at any time by contacting your academy or LEAF support.
          </Section>
          <Section title="Contact">
            Questions about your data? Reach out to the academy you applied to, or LEAF support.
          </Section>
        </div>

        <p className="mt-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-xs text-[var(--color-muted)]">
          This is a working draft for the pilot. A full, jurisdiction-specific privacy policy (GDPR) must replace it
          before commercial launch.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-[var(--color-fg)]">{title}</h2>
      <p className="mt-1.5">{children}</p>
    </div>
  );
}

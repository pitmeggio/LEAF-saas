import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicAcademy } from "@/lib/queries";
import { getPublicOpportunities } from "@/lib/profiles";
import { ApplyForm } from "@/components/ApplyForm";
import { getSession } from "@/lib/auth";
import { applyWithMyProfile } from "@/app/apply-actions";
import { DISCIPLINE_LABEL, fmtDate, fmtMoney } from "@/lib/domain";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { program: "Program", position: "Team position", camp: "Camp", package: "Package" };

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ package?: string; opportunity?: string }>;
}) {
  const { slug } = await params;
  const { package: pkg, opportunity } = await searchParams;
  const academy = await getPublicAcademy(slug);
  if (!academy) notFound();
  const opportunities = await getPublicOpportunities(slug);
  const selected = opportunity ? opportunities.find((o) => o.id === opportunity) : undefined;
  const session = await getSession();
  const isAthlete = !!session?.athleteId;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 md:px-12">
        <Link href={`/academy/${academy.slug}`} className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg font-black" style={{ background: academy.logoColor, color: "#0a0c10" }}>
            {academy.name[0]}
          </div>
          <span className="font-semibold">{academy.name}</span>
        </Link>
        <Link href={`/academy/${academy.slug}`} className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">← Back</Link>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-10 md:py-12">
        {/* Apply with LEAF — one click for athletes with a verified profile */}
        {isAthlete ? (
          <form action={applyWithMyProfile} className="card mb-10 p-5">
            <input type="hidden" name="slug" value={academy.slug} />
            {opportunity && <input type="hidden" name="opportunityId" value={opportunity} />}
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>✦</span>
              <h2 className="text-sm font-semibold">Apply with LEAF</h2>
            </div>
            <p className="mt-1.5 text-sm text-[var(--color-muted)]">
              You&apos;re signed in as <span className="font-medium text-[var(--color-fg)]">{session?.name}</span>. Apply with your verified profile — no forms. {academy.name} receives your performance data, fit score and suggested group instantly.
            </p>
            <button type="submit" className="mt-4 w-full rounded-lg bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] sm:w-auto">
              Apply with my LEAF profile →
            </button>
          </form>
        ) : (
          <div className="card mb-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>✦</span>
                <h2 className="text-sm font-semibold">Already on LEAF?</h2>
              </div>
              <p className="mt-1 text-sm text-[var(--color-muted)]">Sign in and apply with your verified profile in one click — no forms.</p>
            </div>
            <Link href="/login/athlete" className="shrink-0 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:border-[var(--color-accent)]">Sign in &amp; apply →</Link>
          </div>
        )}

        {/* Open applications / opportunities */}
        {opportunities.length > 0 && (
          <section className="mb-10">
            <div className="kicker" style={{ color: "var(--color-accent)" }}>Open applications</div>
            <h1 className="display mt-1 text-2xl font-bold tracking-tight md:text-3xl">Current openings at {academy.name}</h1>
            <div className="mt-5 space-y-3">
              {opportunities.map((o) => {
                const active = o.id === opportunity;
                return (
                  <div key={o.id} className="card p-4" style={active ? { borderColor: "var(--color-accent)" } : undefined}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">{o.title}</div>
                        <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                          {TYPE_LABEL[o.type] ?? o.type}
                          {o.season ? ` · ${o.season}` : ""}{o.ageGroup ? ` · ${o.ageGroup}` : ""}
                          {o.discipline ? ` · ${DISCIPLINE_LABEL[o.discipline] ?? o.discipline}` : ""}
                          {o.spotsAvailable != null ? ` · ${o.spotsAvailable} spots` : ""}
                          {o.applicationDeadline ? ` · deadline ${fmtDate(o.applicationDeadline)}` : ""}
                          {o.price != null ? ` · ${fmtMoney(o.price, o.currency)}` : ""}
                        </div>
                        {o.description && <p className="mt-2 text-sm text-[var(--color-fg)]/85">{o.description}</p>}
                      </div>
                      <Link
                        href={`/academy/${academy.slug}/apply?opportunity=${o.id}#form`}
                        className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold ${active ? "bg-[var(--color-accent)] text-[#0a0c10]" : "border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"}`}
                      >
                        {active ? "Selected ✓" : "Apply"}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Application form */}
        <div id="form">
          <h2 className="display text-2xl font-bold tracking-tight">{opportunities.length > 0 ? "Application" : `Apply to ${academy.name}`}</h2>
          {selected ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">Applying for <span className="font-medium text-[var(--color-fg)]">{selected.title}</span>.</p>
          ) : (
            <p className="mt-1 text-sm text-[var(--color-muted)]">Have a FIS code? Tick the box and your sports CV builds itself. Otherwise, fill in the basics.</p>
          )}
          <div className="mt-6">
            <ApplyForm
              slug={academy.slug}
              packages={academy.packages.map((p) => ({ id: p.id, name: p.name, price: p.price, period: p.period }))}
              defaultPackage={pkg}
              opportunityId={selected?.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useMemo, useState } from "react";
import { submitApplicationAction, type ApplyState } from "@/app/apply-actions";
import { DISCIPLINE_LABEL, COUNTRY } from "@/lib/domain";

type Package = { id: string; name: string; price: number | null; period: string };

const field =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]";
const label = "mb-1 block text-xs font-medium text-[var(--color-muted)]";

function ageFromDob(dob: string): number | null {
  if (!dob || Number.isNaN(Date.parse(dob))) return null;
  const d = new Date(dob);
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function ApplyForm({
  slug,
  packages,
  defaultPackage,
  opportunityId,
}: {
  slug: string;
  packages: Package[];
  defaultPackage?: string;
  opportunityId?: string;
}) {
  const [state, formAction, pending] = useActionState<ApplyState, FormData>(submitApplicationAction, {});
  const [hasFis, setHasFis] = useState(false);
  const [dob, setDob] = useState("");

  const age = useMemo(() => ageFromDob(dob), [dob]);
  const isMinor = age != null && age < 18;

  return (
    <form action={formAction} className="card space-y-5 p-5 sm:p-6">
      <input type="hidden" name="slug" value={slug} />
      {opportunityId && <input type="hidden" name="opportunityId" value={opportunityId} />}

      <Section title="Athlete">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name *">
            <input name="firstName" className={field} required />
          </Field>
          <Field label="Last name *">
            <input name="lastName" className={field} required />
          </Field>
        </div>
        <Field label="Email *">
          <input name="email" type="email" inputMode="email" className={field} required />
        </Field>
      </Section>

      {/* FIS toggle */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={hasFis} onChange={(e) => setHasFis(e.target.checked)} className="accent-[var(--color-accent)]" />
          I have a FIS code (auto-builds my sports CV)
        </label>
        {hasFis && (
          <div className="mt-3">
            <input name="fisCode" placeholder="e.g. 6294001" autoComplete="off" className={`${field} num`} />
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              We&apos;ll import your points, ranking, results and growth trend automatically.
            </p>
          </div>
        )}
      </div>

      {/* Manual sport data — required only when no FIS code */}
      {!hasFis && (
        <Section title="Sport data">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date of birth">
              <input name="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={field} />
            </Field>
            <Field label="Nationality">
              <select name="nationality" className={field} defaultValue="">
                <option value="" disabled>
                  Select…
                </option>
                {Object.entries(COUNTRY).map(([code, c]) => (
                  <option key={code} value={code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sport">
              <select name="sport" className={field} defaultValue="ski">
                <option value="ski">Alpine skiing</option>
                <option value="tennis">Tennis</option>
              </select>
            </Field>
            <Field label="Discipline / category">
              <select name="discipline" className={field} defaultValue="">
                <option value="" disabled>
                  Select…
                </option>
                {Object.entries(DISCIPLINE_LABEL).map(([code, l]) => (
                  <option key={code} value={code}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Current ranking / FIS points / tennis ranking">
            <input name="currentRanking" placeholder="e.g. 28.4 FIS pts · NR 142" className={field} />
          </Field>
        </Section>
      )}

      <Section title="Background">
        <Field label="Previous academy / club">
          <input name="previousClub" placeholder="e.g. Hafjell Ski Club" className={field} />
        </Field>
        <Field label="Short motivation">
          <textarea name="motivation" rows={3} className={`${field} resize-none`} placeholder="Why do you want to join, and what are your goals?" />
        </Field>
        <Field label="Video / documents link (optional)">
          <input name="mediaLink" type="url" inputMode="url" placeholder="https://…" className={field} />
        </Field>
      </Section>

      {/* Guardian — shown for under-18 manual applicants */}
      {!hasFis && isMinor && (
        <Section title="Parent / guardian (athlete is under 18)">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guardian name">
              <input name="guardianName" className={field} />
            </Field>
            <Field label="Guardian contact (email / phone)">
              <input name="guardianContact" className={field} />
            </Field>
          </div>
        </Section>
      )}

      <Section title="Preference">
        <Field label="Preferred program / package">
          <select name="packageId" className={field} defaultValue={defaultPackage ?? ""}>
            <option value="">No preference</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.price != null ? ` · €${p.price.toLocaleString("en-US")}` : ""}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {state.error && (
        <p className="rounded-lg border border-[#f8717140] bg-[#f871711a] px-3 py-2 text-sm text-[#f87171]">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">{title}</div>
      {children}
    </div>
  );
}

function Field({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={label}>{l}</label>
      {children}
    </div>
  );
}

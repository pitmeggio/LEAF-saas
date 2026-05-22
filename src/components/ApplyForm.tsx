"use client";

import { useActionState, useMemo, useState } from "react";
import { submitApplicationAction, type ApplyState } from "@/app/apply-actions";
import { DISCIPLINE_LABEL, COUNTRY } from "@/lib/domain";
import { fieldHidesWithFis, type ApplicationFieldConfig } from "@/lib/applicationForm";

type Package = { id: string; name: string; price: number | null; period: string };

const field =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--color-muted)]";

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
  fields,
}: {
  slug: string;
  packages: Package[];
  defaultPackage?: string;
  opportunityId?: string;
  fields: ApplicationFieldConfig[];
}) {
  const [state, formAction, pending] = useActionState<ApplyState, FormData>(submitApplicationAction, {});
  const [hasFis, setHasFis] = useState(false);
  const [dob, setDob] = useState("");

  const age = useMemo(() => ageFromDob(dob), [dob]);
  const isMinor = age != null && age < 18;

  // Index enabled fields by key; only enabled fields are rendered.
  const byKey = useMemo(() => {
    const m = new Map<string, ApplicationFieldConfig>();
    for (const f of fields) if (f.enabled) m.set(f.key, f);
    return m;
  }, [fields]);
  const customFields = useMemo(() => fields.filter((f) => f.enabled && f.custom), [fields]);

  const has = (key: string) => byKey.has(key);
  const lbl = (key: string, fallback: string) => byKey.get(key)?.label ?? fallback;
  const req = (key: string) => byKey.get(key)?.required ?? false;
  const star = (key: string) => (req(key) ? " *" : "");

  // Sport-data fields hide when a FIS code is supplied (auto-filled on import).
  const showSport = !hasFis && ["dob", "nationality", "sport", "discipline", "currentRanking"].some(
    (k) => has(k) && fieldHidesWithFis(k),
  );
  const showGuardian = !hasFis && isMinor && (has("guardianName") || has("guardianContact"));

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
      {showSport && (
        <Section title="Sport data">
          <div className="grid gap-4 sm:grid-cols-2">
            {has("dob") && (
              <Field label={lbl("dob", "Date of birth") + star("dob")}>
                <input name="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={field} required={req("dob")} />
              </Field>
            )}
            {has("nationality") && (
              <Field label={lbl("nationality", "Nationality") + star("nationality")}>
                <select name="nationality" className={field} defaultValue="" required={req("nationality")}>
                  <option value="" disabled>Select…</option>
                  {Object.entries(COUNTRY).map(([code, c]) => (
                    <option key={code} value={code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </Field>
            )}
            {has("sport") && (
              <Field label={lbl("sport", "Sport") + star("sport")}>
                <select name="sport" className={field} defaultValue="ski" required={req("sport")}>
                  <option value="ski">Alpine skiing</option>
                  <option value="tennis">Tennis</option>
                </select>
              </Field>
            )}
            {has("discipline") && (
              <Field label={lbl("discipline", "Discipline / category") + star("discipline")}>
                <select name="discipline" className={field} defaultValue="" required={req("discipline")}>
                  <option value="" disabled>Select…</option>
                  {Object.entries(DISCIPLINE_LABEL).map(([code, l]) => (
                    <option key={code} value={code}>{l}</option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          {has("currentRanking") && (
            <Field label={lbl("currentRanking", "Current ranking / points") + star("currentRanking")}>
              <input name="currentRanking" placeholder={byKey.get("currentRanking")?.placeholder ?? "e.g. 28.4 FIS pts · NR 142"} className={field} required={req("currentRanking")} />
            </Field>
          )}
        </Section>
      )}

      {(has("previousClub") || has("motivation") || has("mediaLink")) && (
        <Section title="Background">
          {has("previousClub") && (
            <Field label={lbl("previousClub", "Previous academy / club") + star("previousClub")}>
              <input name="previousClub" placeholder={byKey.get("previousClub")?.placeholder ?? "e.g. Hafjell Ski Club"} className={field} required={req("previousClub")} />
            </Field>
          )}
          {has("motivation") && (
            <Field label={lbl("motivation", "Short motivation") + star("motivation")}>
              <textarea name="motivation" rows={3} className={`${field} resize-none`} placeholder={byKey.get("motivation")?.placeholder ?? "Why do you want to join, and what are your goals?"} required={req("motivation")} />
            </Field>
          )}
          {has("mediaLink") && (
            <Field label={lbl("mediaLink", "Video / documents link") + star("mediaLink")}>
              <input name="mediaLink" type="url" inputMode="url" placeholder={byKey.get("mediaLink")?.placeholder ?? "https://…"} className={field} required={req("mediaLink")} />
            </Field>
          )}
        </Section>
      )}

      {/* Academy-defined custom questions */}
      {customFields.length > 0 && (
        <Section title="Additional questions">
          {customFields.map((f) => (
            <Field key={f.key} label={f.label + (f.required ? " *" : "")}>
              <CustomFieldInput f={f} />
            </Field>
          ))}
        </Section>
      )}

      {/* Guardian — shown for under-18 manual applicants */}
      {showGuardian && (
        <Section title="Parent / guardian (athlete is under 18)">
          <div className="grid gap-4 sm:grid-cols-2">
            {has("guardianName") && (
              <Field label={lbl("guardianName", "Guardian name") + star("guardianName")}>
                <input name="guardianName" className={field} required={req("guardianName")} />
              </Field>
            )}
            {has("guardianContact") && (
              <Field label={lbl("guardianContact", "Guardian contact (email / phone)") + star("guardianContact")}>
                <input name="guardianContact" className={field} required={req("guardianContact")} />
              </Field>
            )}
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

      <label className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-[var(--color-accent)]" />
        <span>
          I agree to LEAF processing my (or my child&apos;s) published competition data to build this application, per the{" "}
          <a href="/privacy" target="_blank" className="text-[var(--color-accent)] hover:underline">privacy terms</a>.
        </span>
      </label>

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

// Renders a custom (academy-defined) field. Its answer is submitted under
// `custom_<key>` and routed to Application.customFields by the server action.
function CustomFieldInput({ f }: { f: ApplicationFieldConfig }) {
  const name = `custom_${f.key}`;
  if (f.type === "textarea") {
    return <textarea name={name} rows={3} className={`${field} resize-none`} placeholder={f.placeholder} required={f.required} />;
  }
  if (f.type === "select") {
    return (
      <select name={name} className={field} defaultValue="" required={f.required}>
        <option value="" disabled>Select…</option>
        {(f.options ?? []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  const inputType = f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text";
  return <input name={name} type={inputType} className={field} placeholder={f.placeholder} required={f.required} />;
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
      <label className={labelCls}>{l}</label>
      {children}
    </div>
  );
}

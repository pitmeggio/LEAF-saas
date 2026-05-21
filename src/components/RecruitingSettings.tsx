"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRecruitingSettings } from "@/app/recruiting-actions";
import { RecruitingBadge } from "@/components/Recruiting";
import type { RecruitingStatus } from "@/lib/profiles";

const PROGRAM_TYPES = ["Full Package", "Training Only", "Race Support", "Custom"] as const;
const STATUSES: RecruitingStatus[] = ["OPEN", "LIMITED_SPOTS", "WAITLIST_OPEN", "CLOSED"];

export type RecruitingValues = {
  slug: string;
  recruitingEnabled: boolean;
  recruitingStatus: RecruitingStatus;
  publicRecruitingHeadline: string | null;
  publicRecruitingDescription: string | null;
  season: string | null;
  applicationDeadline: string | null; // YYYY-MM-DD
  availableSpots: number | null;
  acceptedCountries: string | null;
  ageCategories: string | null;
  rankingRequirement: string | null;
  programTypes: string[];
  applicationUrl: string | null;
  featuredAcademy: boolean;
  contactEmail: string | null;
  publicApplyEnabled: boolean;
};

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-xs text-[var(--color-muted)]";

export function RecruitingSettings({ initial }: { initial: RecruitingValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [f, setF] = useState<RecruitingValues>(initial);

  const set = <K extends keyof RecruitingValues>(k: K, v: RecruitingValues[K]) => { setF((p) => ({ ...p, [k]: v })); setOk(false); };
  const toggleProgram = (p: string) => set("programTypes", f.programTypes.includes(p) ? f.programTypes.filter((x) => x !== p) : [...f.programTypes, p]);

  const publicHref = `/academy/${f.slug}`;

  const save = () => {
    setError(null);
    start(async () => {
      const r = await updateRecruitingSettings({
        recruitingEnabled: f.recruitingEnabled,
        recruitingStatus: f.recruitingStatus,
        publicRecruitingHeadline: f.publicRecruitingHeadline ?? undefined,
        publicRecruitingDescription: f.publicRecruitingDescription ?? undefined,
        season: f.season ?? undefined,
        applicationDeadline: f.applicationDeadline ?? undefined,
        availableSpots: f.availableSpots,
        acceptedCountries: f.acceptedCountries ?? undefined,
        ageCategories: f.ageCategories ?? undefined,
        rankingRequirement: f.rankingRequirement ?? undefined,
        programTypes: f.programTypes as ("Full Package" | "Training Only" | "Race Support" | "Custom")[],
        applicationUrl: f.applicationUrl ?? undefined,
        featuredAcademy: f.featuredAcademy,
        contactEmail: f.contactEmail ?? undefined,
        publicApplyEnabled: f.publicApplyEnabled,
      });
      if (r.ok) { setOk(true); router.refresh(); } else setError(r.error ?? "Something went wrong");
    });
  };

  return (
    <div className="space-y-6">
      {/* Master toggle + status */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Public recruiting</h2>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">Show this academy on Leaf Profiles as recruiting.</p>
          </div>
          <Toggle checked={f.recruitingEnabled} onChange={(v) => set("recruitingEnabled", v)} label={f.recruitingEnabled ? "Enabled" : "Disabled"} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Recruiting status</label>
            <select className={inp} value={f.recruitingStatus} onChange={(e) => set("recruitingStatus", e.target.value as RecruitingStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="mt-2"><RecruitingBadge status={f.recruitingStatus} size="sm" /></div>
          </div>
          <div className="flex items-end gap-2">
            <a href={publicHref} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium hover:bg-[var(--color-surface-2)]">Preview public page ↗</a>
          </div>
        </div>
      </div>

      {/* Public messaging */}
      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold">Public messaging</h2>
        <div>
          <label className={lbl}>Headline</label>
          <input className={inp} value={f.publicRecruitingHeadline ?? ""} maxLength={160} placeholder="e.g. Recruiting athletes for the 2026/27 season" onChange={(e) => set("publicRecruitingHeadline", e.target.value || null)} />
        </div>
        <div>
          <label className={lbl}>Description</label>
          <textarea className={`${inp} min-h-24`} value={f.publicRecruitingDescription ?? ""} maxLength={2000} placeholder="What you're looking for and what the program offers…" onChange={(e) => set("publicRecruitingDescription", e.target.value || null)} />
        </div>
      </div>

      {/* Intake */}
      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold">Intake</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={lbl}>Season</label>
            <input className={inp} value={f.season ?? ""} placeholder="2026/27" onChange={(e) => set("season", e.target.value || null)} />
          </div>
          <div>
            <label className={lbl}>Application deadline</label>
            <input type="date" className={inp} value={f.applicationDeadline ?? ""} onChange={(e) => set("applicationDeadline", e.target.value || null)} />
          </div>
          <div>
            <label className={lbl}>Available spots</label>
            <input type="number" min={0} className={inp} value={f.availableSpots ?? ""} placeholder="e.g. 6" onChange={(e) => set("availableSpots", e.target.value === "" ? null : Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className={lbl}>Program types</label>
          <div className="flex flex-wrap gap-2">
            {PROGRAM_TYPES.map((p) => {
              const on = f.programTypes.includes(p);
              return (
                <button type="button" key={p} onClick={() => toggleProgram(p)} className={`rounded-lg border px-3 py-1.5 text-sm ${on ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-fg)]" : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"}`}>
                  {on ? "✓ " : ""}{p}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Eligibility */}
      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold">Eligibility</h2>
        <div>
          <label className={lbl}>Accepted countries <span className="text-[var(--color-muted)]">(ISO codes or names, comma-separated)</span></label>
          <input className={inp} value={f.acceptedCountries ?? ""} placeholder="NO, SE, AT, IT" onChange={(e) => set("acceptedCountries", e.target.value || null)} />
        </div>
        <div>
          <label className={lbl}>Age categories <span className="text-[var(--color-muted)]">(comma-separated)</span></label>
          <input className={inp} value={f.ageCategories ?? ""} placeholder="U16, U18, U21" onChange={(e) => set("ageCategories", e.target.value || null)} />
        </div>
        <div>
          <label className={lbl}>Ranking requirement</label>
          <input className={inp} value={f.rankingRequirement ?? ""} placeholder="e.g. FIS points under 60, or national-level results" onChange={(e) => set("rankingRequirement", e.target.value || null)} />
        </div>
      </div>

      {/* Contact + flags */}
      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold">Contact & options</h2>
        <div>
          <label className={lbl}>Contact email</label>
          <input className={inp} value={f.contactEmail ?? ""} placeholder="recruiting@academy.com" onChange={(e) => set("contactEmail", e.target.value || null)} />
        </div>
        <div>
          <label className={lbl}>External application URL <span className="text-[var(--color-muted)]">(optional — overrides the built-in apply form)</span></label>
          <input className={inp} value={f.applicationUrl ?? ""} placeholder="https://… (leave blank to use the Leaf apply form)" onChange={(e) => set("applicationUrl", e.target.value || null)} />
        </div>
        <div className="space-y-2">
          <Toggle checked={f.publicApplyEnabled} onChange={(v) => set("publicApplyEnabled", v)} label="Enable public Apply button" />
          <Toggle checked={f.featuredAcademy} onChange={(v) => set("featuredAcademy", v)} label="Featured academy" />
        </div>
      </div>

      {error && <p className="text-sm text-[#f87171]">{error}</p>}
      <div className="flex items-center justify-between">
        {ok ? <span className="text-xs text-[#7cff6b]">Saved ✓</span> : <span />}
        <button onClick={save} disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          {pending ? "Saving…" : "Save recruiting settings"}
        </button>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 text-left text-sm">
      <span>{label}</span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface-2)] border border-[var(--color-border)]"}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${checked ? "translate-x-4" : "translate-x-1"}`} style={{ background: checked ? "#0a0c10" : "#fff" }} />
      </span>
    </button>
  );
}

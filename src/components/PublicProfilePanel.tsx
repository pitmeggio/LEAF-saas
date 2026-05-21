"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePublicProfile } from "@/app/profile-actions";

export type PublicProfileValues = {
  athleteId: string;
  publicProfileEnabled: boolean;
  publicSlug: string | null;
  publicVisibility: string;
  publicBio: string | null;
  publicPhotoUrl: string | null;
  publicShowAcademy: boolean;
  publicShowRanking: boolean;
  publicShowResults: boolean;
  publicShowMedia: boolean;
  publicShowExternalProfiles: boolean;
  publicContactEnabled: boolean;
  publicVerified: boolean;
  fisCode: string | null;
  fisProfileUrl: string | null;
  atpPlayerId: string | null;
  atpProfileUrl: string | null;
};

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-xs text-[var(--color-muted)]";

export function PublicProfilePanel({ initial }: { initial: PublicProfileValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [copied, setCopied] = useState(false);
  const [f, setF] = useState<PublicProfileValues>(initial);

  const set = <K extends keyof PublicProfileValues>(k: K, v: PublicProfileValues[K]) => { setF((p) => ({ ...p, [k]: v })); setOk(false); };

  const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const publicUrl = f.publicSlug ? `/athlete/${f.publicSlug}` : null;

  const save = () => {
    setError(null);
    start(async () => {
      const r = await updatePublicProfile({
        athleteId: f.athleteId,
        publicProfileEnabled: f.publicProfileEnabled,
        publicSlug: f.publicSlug ?? undefined,
        publicVisibility: f.publicVisibility as "PUBLIC" | "PRIVATE" | "INVITE_ONLY" | "ACADEMY_ONLY",
        publicBio: f.publicBio ?? undefined,
        publicPhotoUrl: f.publicPhotoUrl ?? undefined,
        publicShowAcademy: f.publicShowAcademy,
        publicShowRanking: f.publicShowRanking,
        publicShowResults: f.publicShowResults,
        publicShowMedia: f.publicShowMedia,
        publicShowExternalProfiles: f.publicShowExternalProfiles,
        publicContactEnabled: f.publicContactEnabled,
        publicVerified: f.publicVerified,
        fisCode: f.fisCode ?? undefined,
        fisProfileUrl: f.fisProfileUrl ?? undefined,
        atpPlayerId: f.atpPlayerId ?? undefined,
        atpProfileUrl: f.atpProfileUrl ?? undefined,
      });
      if (r.ok) { setOk(true); router.refresh(); } else setError(r.error ?? "Something went wrong");
    });
  };

  const copyLink = () => {
    if (!publicUrl) return;
    const full = `${window.location.origin}${publicUrl}`;
    navigator.clipboard?.writeText(full).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Public profile</h3>
        <Toggle checked={f.publicProfileEnabled} onChange={(v) => set("publicProfileEnabled", v)} label={f.publicProfileEnabled ? "Enabled" : "Disabled"} />
      </div>

      <div className="space-y-4">
        <div>
          <label className={lbl}>Public link</label>
          <div className="flex gap-2">
            <span className="flex items-center rounded-l-lg border border-r-0 border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-muted)]">/profiles/</span>
            <input className={`${inp} rounded-l-none`} value={f.publicSlug ?? ""} placeholder="firstname-lastname" onChange={(e) => set("publicSlug", slugify(e.target.value) || null)} />
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={copyLink} disabled={!publicUrl} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-40">
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
                Preview ↗
              </a>
            )}
          </div>
        </div>

        <div>
          <label className={lbl}>Visibility</label>
          <select className={inp} value={f.publicVisibility} onChange={(e) => set("publicVisibility", e.target.value)}>
            <option value="PRIVATE">Private (hidden)</option>
            <option value="PUBLIC">Public (anyone with the link)</option>
            <option value="ACADEMY_ONLY">Academy only (logged-in academy members)</option>
            <option value="INVITE_ONLY">Invite only (coming soon)</option>
          </select>
        </div>

        <div>
          <label className={lbl}>Verified badge</label>
          <Toggle checked={f.publicVerified} onChange={(v) => set("publicVerified", v)} label="Show verified badge" />
        </div>

        <div>
          <label className={lbl}>Public bio</label>
          <textarea className={`${inp} min-h-20`} value={f.publicBio ?? ""} maxLength={1500} placeholder="Short recruiting bio shown on the public profile…" onChange={(e) => set("publicBio", e.target.value || null)} />
        </div>

        <div>
          <label className={lbl}>Public photo URL</label>
          <input className={inp} value={f.publicPhotoUrl ?? ""} placeholder="https://…" onChange={(e) => set("publicPhotoUrl", e.target.value || null)} />
        </div>

        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <div className="mb-2 text-xs font-medium text-[var(--color-muted)]">Sections shown publicly</div>
          <div className="space-y-2">
            <Toggle checked={f.publicShowAcademy} onChange={(v) => set("publicShowAcademy", v)} label="Academy name" />
            <Toggle checked={f.publicShowRanking} onChange={(v) => set("publicShowRanking", v)} label="Ranking / FIS points" />
            <Toggle checked={f.publicShowResults} onChange={(v) => set("publicShowResults", v)} label="Latest results" />
            <Toggle checked={f.publicShowMedia} onChange={(v) => set("publicShowMedia", v)} label="Media portfolio" />
            <Toggle checked={f.publicShowExternalProfiles} onChange={(v) => set("publicShowExternalProfiles", v)} label="External profiles (FIS/ATP)" />
            <Toggle checked={f.publicContactEnabled} onChange={(v) => set("publicContactEnabled", v)} label="Contact / recruit button" />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <div className="mb-2 text-xs font-medium text-[var(--color-muted)]">External profiles</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>FIS code</label><input className={inp} value={f.fisCode ?? ""} onChange={(e) => set("fisCode", e.target.value || null)} /></div>
              <div><label className={lbl}>ATP player ID</label><input className={inp} value={f.atpPlayerId ?? ""} onChange={(e) => set("atpPlayerId", e.target.value || null)} /></div>
            </div>
            <div><label className={lbl}>FIS profile URL</label><input className={inp} value={f.fisProfileUrl ?? ""} placeholder="https://…" onChange={(e) => set("fisProfileUrl", e.target.value || null)} /></div>
            <div><label className={lbl}>ATP profile URL</label><input className={inp} value={f.atpProfileUrl ?? ""} placeholder="https://…" onChange={(e) => set("atpProfileUrl", e.target.value || null)} /></div>
          </div>
        </div>

        {error && <p className="text-sm text-[#f87171]">{error}</p>}
        <div className="flex items-center justify-between">
          {ok ? <span className="text-xs text-[#7cff6b]">Saved ✓</span> : <span />}
          <button onClick={save} disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
            {pending ? "Saving…" : "Save public profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 text-left text-sm">
      <span>{label}</span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface-2)] border border-[var(--color-border)]"}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-1"}`} style={checked ? { background: "#0a0c10" } : undefined} />
      </span>
    </button>
  );
}

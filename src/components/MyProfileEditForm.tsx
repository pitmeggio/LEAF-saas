"use client";

import { useActionState } from "react";
import { updateMyProfile, type MyProfileState } from "@/app/me-actions";

const field = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

export function MyProfileEditForm({ initial }: { initial: { publicBio: string | null; publicPhotoUrl: string | null; publicContactEnabled: boolean } }) {
  const [state, formAction, pending] = useActionState<MyProfileState, FormData>(updateMyProfile, {});
  return (
    <form action={formAction} className="card space-y-4 p-6">
      <h3 className="text-sm font-semibold">Edit my profile</h3>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Bio</label>
        <textarea name="publicBio" rows={4} defaultValue={initial.publicBio ?? ""} placeholder="Tell academies and coaches about yourself…" className={`${field} resize-none`} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Photo URL</label>
        <input name="publicPhotoUrl" type="url" defaultValue={initial.publicPhotoUrl ?? ""} placeholder="https://…" className={field} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publicContactEnabled" defaultChecked={initial.publicContactEnabled} className="accent-[var(--color-accent)]" />
        Allow recruiting contact on my public profile
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state.ok && <span className="text-sm text-[var(--color-accent)]">Saved ✓</span>}
        {state.error && <span className="text-sm text-[#f87171]">{state.error}</span>}
      </div>
    </form>
  );
}

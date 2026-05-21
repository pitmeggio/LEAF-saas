"use client";

import { useActionState } from "react";
import { submitAcademyRequest, type RequestState } from "@/app/request-actions";

const field = "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-xs font-medium text-[var(--color-muted)]";

export function RequestAcademyForm() {
  const [state, formAction, pending] = useActionState<RequestState, FormData>(submitAcademyRequest, {});

  if (state.ok) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-xl" style={{ background: "#7cff6b1a", color: "var(--color-accent)" }}>✓</div>
        <h2 className="text-xl font-bold">Request received</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-muted)]">
          Thanks — we'll review your academy and get back to you by email. Once approved, your workspace and owner account are provisioned automatically.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={lbl}>Academy name</label><input name="academyName" className={field} placeholder="Trysil Race Academy" required /></div>
        <div><label className={lbl}>Your name</label><input name="contactName" className={field} placeholder="Anna Keller" required /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={lbl}>Email</label><input name="email" type="email" className={field} placeholder="you@academy.com" required /></div>
        <div><label className={lbl}>Phone (optional)</label><input name="phone" className={field} placeholder="+47 …" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className={lbl}>Country code</label><input name="country" maxLength={2} className={`${field} num uppercase`} placeholder="NO" required /></div>
        <div className="sm:col-span-2"><label className={lbl}>Location (optional)</label><input name="location" className={field} placeholder="Trysil, Norway" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={lbl}>Sport</label><input name="sport" className={field} defaultValue="ski" /></div>
        <div>
          <label className={lbl}>Plan of interest</label>
          <select name="plan" defaultValue="PRO" className={field}>
            <option value="BASIC">Basic</option>
            <option value="PRO">Pro</option>
            <option value="ELITE">Elite</option>
          </select>
        </div>
      </div>
      <div><label className={lbl}>What do you need? (optional)</label><textarea name="message" rows={3} className={field} placeholder="Tell us about your academy, athletes and what you want from LEAF." /></div>

      {state.error && <p className="text-sm text-[#f87171]">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
        {pending ? "Submitting…" : "Request access"}
      </button>
      <p className="text-center text-xs text-[var(--color-muted)]">No payment now. A LEAF admin reviews every academy before onboarding.</p>
    </form>
  );
}

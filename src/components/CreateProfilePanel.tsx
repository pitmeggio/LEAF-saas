"use client";

import { useActionState, useEffect, useState } from "react";
import { createProfileAction, type CreateProfileState } from "@/app/explore/create-actions";

const field =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]";

// Real FIS codes (resolve to live FIS points-list data). Try your own too.
const DEMO_CODES = ["512269", "297601", "422304", "194364"];

export function CreateProfileButton({ variant = "solid" }: { variant?: "solid" | "outline" }) {
  const [open, setOpen] = useState(false);
  const cls =
    variant === "solid"
      ? "rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]"
      : "rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold hover:border-[var(--color-accent)]";
  return (
    <>
      <button onClick={() => setOpen(true)} className={cls}>
        Create your profile
      </button>
      {open && <CreateProfileModal onClose={() => setOpen(false)} />}
    </>
  );
}

function CreateProfileModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState<CreateProfileState, FormData>(createProfileAction, {});
  const [source, setSource] = useState<"fis" | "atp">("fis");

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl">
        <div className="relative border-b border-[var(--color-border)] p-6">
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
          <div className="relative">
            <div className="kicker mb-1.5" style={{ color: "var(--color-accent)" }}>Create your profile</div>
            <h2 className="display text-xl font-bold">Import your verified record</h2>
            <p className="mt-1.5 text-sm text-[var(--color-muted)]">
              Enter your name and your federation code — FIS for ski, ATP for tennis. LEAF pulls your published results and builds your analysis automatically.
            </p>
          </div>
          <button onClick={onClose} className="absolute right-4 top-4 text-[var(--color-muted)] hover:text-[var(--color-fg)]">✕</button>
        </div>

        <form action={formAction} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">First name</label>
              <input name="firstName" placeholder="Ingrid" className={field} autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Last name</label>
              <input name="lastName" placeholder="Solberg" className={field} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">Source</label>
            <div className="flex rounded-xl border border-[var(--color-border)] p-0.5">
              {(["fis", "atp"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${source === s ? "bg-[var(--color-accent)] text-[#0a0c10]" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"}`}
                >
                  {s === "fis" ? "FIS · Ski" : "ATP · Tennis"}
                </button>
              ))}
            </div>
            <input type="hidden" name="source" value={source} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Email</label>
              <input name="email" type="email" placeholder="you@email.com" className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Password</label>
              <input name="password" type="password" placeholder="min 8 chars" className={field} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              {source === "fis" ? "FIS code" : "ATP player ID"}
            </label>
            <input name="code" placeholder={source === "fis" ? "e.g. 512269" : "e.g. a0e2"} className={`${field} num`} />
            {source === "fis" && (
              <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                Try a demo code:{" "}
                {DEMO_CODES.map((c, i) => (
                  <span key={c} className="num text-[var(--color-fg)]">{c}{i < DEMO_CODES.length - 1 ? ", " : ""}</span>
                ))}
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
            <input type="checkbox" name="consent" required className="mt-0.5 accent-[var(--color-accent)]" />
            <span>
              I agree to LEAF processing my published competition data to build my profile, per the{" "}
              <a href="/privacy" target="_blank" className="text-[var(--color-accent)] hover:underline">privacy terms</a>.
            </span>
          </label>

          {state.error && <p className="text-sm text-[#f87171]">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
          >
            {pending ? "Importing your record…" : "Import & build my profile"}
          </button>
          <p className="text-center text-xs text-[var(--color-muted)]">
            We only read publicly-published competition data. You control what stays visible.
          </p>
        </form>
      </div>
    </div>
  );
}

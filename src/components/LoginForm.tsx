"use client";

import { useActionState, useState } from "react";
import { signInWithEmail, signIn, type SignInState } from "@/app/auth-actions";

type DemoUser = { id: string; name: string; role: string; email: string };

const ROLE_LABEL: Record<string, string> = { academy_admin: "Academy admin", coach: "Coach", athlete: "Athlete", recruiter: "Recruiter" };
const field = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]";

export function LoginForm({ demoUsers }: { demoUsers: DemoUser[] }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInWithEmail, {});
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Welcome back. Sign in to your academy workspace.</p>

      <form action={formAction} className="mt-7 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Email</label>
          <input name="email" type="email" autoComplete="email" placeholder="you@academy.com" className={field} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Password</label>
          <input name="password" type="password" autoComplete="current-password" placeholder="••••••••" className={field} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Academy code <span className="opacity-60">(optional)</span></label>
          <input name="academyCode" placeholder="e.g. TRYSIL" className={`${field} num`} />
        </div>
        {state.error && <p className="text-sm text-[#f87171]">{state.error}</p>}
        <button type="submit" disabled={pending} className="w-full rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--color-muted)]">
        <span className="h-px flex-1 bg-[var(--color-border)]" /> or continue with <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["Google", "Microsoft", "SSO"].map((p) => (
          <button key={p} disabled title="Coming soon" className="cursor-not-allowed rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)] opacity-60">
            {p}
          </button>
        ))}
      </div>

      <div className="mt-8 border-t border-[var(--color-border)] pt-4">
        <button onClick={() => setShowDemo((v) => !v)} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]">
          {showDemo ? "▾" : "▸"} Demo access
        </button>
        {showDemo && (
          <div className="mt-3 space-y-2">
            {demoUsers.map((u) => (
              <form key={u.id} action={signIn.bind(null, u.id)}>
                <button type="submit" className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-left text-sm hover:border-[var(--color-accent)]/50">
                  <span>{u.name}</span>
                  <span className="text-xs text-[var(--color-muted)]">{ROLE_LABEL[u.role] ?? u.role}</span>
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

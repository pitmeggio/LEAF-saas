"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCoachLogin, resetCoachPassword } from "@/app/coach-login-actions";

// Inline action on the coach card: opens a small dialog that either
// creates a fresh login (when the coach has no User account yet) or
// resets the password (when one already exists). Admin-only — server
// action verifies both the academy scope and the requesting role.

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

type Props = {
  coachId: string;
  coachName: string;
  existingEmail: string | null;       // null when no User account yet
  presetEmail: string | null;         // Coach.email to pre-fill on create
};

export function CoachLoginButton({ coachId, coachName, existingEmail, presetEmail }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState(existingEmail ?? presetEmail ?? "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    start(async () => {
      const r = existingEmail
        ? await resetCoachPassword({ coachId, password })
        : await createCoachLogin({ coachId, email, password });
      if (r.ok) {
        setMsg(existingEmail ? "Password reset." : `Login created for ${email}.`);
        router.refresh();
        // Auto-close after a beat so the admin sees confirmation.
        setTimeout(() => setOpen(false), 1200);
      } else {
        setErr(r.error);
      }
    });
  };

  if (existingEmail && !open) {
    // Compact mode when login already exists: show email + a reset link.
    return (
      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Login</div>
            <div className="truncate font-medium">{existingEmail}</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium hover:bg-[var(--color-surface)]"
          >
            Reset password
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-lg border border-[#7CFF6B40] bg-[#7cff6b12] px-3 py-2 text-xs font-medium text-[var(--color-accent)] hover:bg-[#7cff6b20]"
      >
        + Create login account
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">
          {existingEmail ? `Reset password for ${coachName}` : `Create login for ${coachName}`}
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">
          ×
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-2">
        {!existingEmail && (
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Email</label>
            <input
              type="email"
              className={inp}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@trysilraceacademy.no"
              required
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            {existingEmail ? "New password" : "Password"}
          </label>
          <input
            type="text"
            className={inp}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min 6 characters"
            minLength={6}
            required
          />
          <p className="mt-1 text-[9px] text-[var(--color-muted)]">
            Share this with the coach. They sign in at <span className="num">/login</span>.
          </p>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="text-[10px]">
            {err && <span className="text-[#f87171]">{err}</span>}
            {msg && !err && <span className="text-[var(--color-accent)]">{msg}</span>}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-[#7CFF6B40] bg-[#7cff6b12] px-3 py-1.5 text-[11px] font-medium text-[var(--color-accent)] disabled:opacity-50"
          >
            {pending ? "Saving…" : existingEmail ? "Reset" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

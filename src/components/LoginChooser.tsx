"use client";

import Link from "next/link";
import { useState } from "react";
import { LoginForm } from "@/components/LoginForm";

type DemoUser = { id: string; name: string; role: string; email: string };
type Mode = "athlete" | "academy";

// Sign-in entry: first pick the account type (two cards), then reveal the matching
// login form inline. Keeps a single /login entry while routing athletes vs academies
// to the right form. /login/athlete still works as a direct link.
export function LoginChooser({ demoUsers }: { demoUsers: DemoUser[] }) {
  const [mode, setMode] = useState<Mode | null>(null);

  if (mode) {
    return (
      <div className="w-full max-w-sm">
        <button onClick={() => setMode(null)} className="mb-5 inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]">
          ← Change account type
        </button>
        <LoginForm demoUsers={mode === "academy" ? demoUsers : []} variant={mode} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold tracking-tight">Sign in to LEAF</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Choose how you use LEAF.</p>

      <div className="mt-7 space-y-3">
        <ChoiceCard
          onClick={() => setMode("athlete")}
          icon="🏅"
          title="Athlete profile"
          desc="Manage your verified profile, AI insights and share link."
        />
        <ChoiceCard
          onClick={() => setMode("academy")}
          icon="🏛"
          title="Academy profile"
          desc="Run your academy — recruiting, athletes, finance and performance."
        />
      </div>

      <div className="mt-8 border-t border-[var(--color-border)] pt-4 text-center text-xs text-[var(--color-muted)]">
        New athlete? <Link href="/explore" className="font-medium text-[var(--color-accent)] hover:underline">Create your profile →</Link>
      </div>
    </div>
  );
}

function ChoiceCard({ onClick, icon, title, desc }: { onClick: () => void; icon: string; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className="card pop flex w-full items-center gap-4 p-4 text-left transition-colors hover:border-[var(--color-accent)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: "var(--color-surface-2)" }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{desc}</span>
      </span>
      <span className="shrink-0 text-[var(--color-muted)]">→</span>
    </button>
  );
}

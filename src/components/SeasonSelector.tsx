"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveSeason } from "@/app/season-actions";

// Global season selector — small dropdown that lives at the top of the sidebar.
// Changing the season sets a cookie + revalidates the season-aware pages.
export function SeasonSelector({ active, seasons, isCurrent }: { active: string; seasons: string[]; isCurrent: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5">
      <label className="block text-[9px] uppercase tracking-[0.14em] text-[var(--color-muted)]/70">Season</label>
      <select
        value={active}
        disabled={pending}
        onChange={(e) => start(async () => { await setActiveSeason(e.target.value); router.refresh(); })}
        className="num w-full bg-transparent text-sm font-semibold text-[var(--color-fg)] outline-none disabled:opacity-50"
      >
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s}{!isCurrent && s === active ? " · viewing" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bookSlotPublicly } from "@/app/line-actions";

// Inline booking form on each Pay-and-Train slot card. We keep it collapsed
// behind a "Book this slot" button so the day grid stays scannable — the
// form expands only when the visitor commits to a specific slot.
export function BookSlotForm({
  slug,
  slotId,
  weekParam,
}: {
  slug: string;
  slotId: string;
  weekParam: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await bookSlotPublicly({
        slotId,
        customerName: name,
        customerEmail: email,
        customerPhone: phone || undefined,
      });
      if (r.ok) {
        const q = weekParam ? `w=${weekParam}&ok=1` : "ok=1";
        router.push(`/academy/${slug}/book?${q}`);
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
      >
        Book this slot →
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 border-t border-[var(--color-border)] pt-3 text-sm">
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Full name *</label>
        <input
          className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Email *</label>
        <input
          type="email"
          className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Phone</label>
        <input
          type="tel"
          className="mt-0.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {err && <p className="text-[11px] text-[#f87171]">{err}</p>}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-xs text-[var(--color-muted)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-[#7CFF6B40] bg-[#7cff6b12] px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] disabled:opacity-50"
        >
          {pending ? "Booking…" : "Confirm booking"}
        </button>
      </div>
    </form>
  );
}

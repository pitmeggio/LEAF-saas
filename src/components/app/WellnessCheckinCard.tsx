"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { submitCheckin } from "@/app/wellness-actions";
import { WELLNESS_ITEMS, computeReadiness, readinessBand, BAND_COLOR, BAND_LABEL, type WellnessItemKey } from "@/lib/wellnessCore";
import type { CheckinRow } from "@/lib/wellness";

type Vals = Record<WellnessItemKey, number>;
const DEFAULTS: Vals = { sleepQuality: 3, energy: 3, soreness: 2, mood: 3, stress: 2 };

export function WellnessCheckinCard({ today }: { today: CheckinRow | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(!today);
  const [err, setErr] = useState<string | null>(null);
  const [vals, setVals] = useState<Vals>(today
    ? { sleepQuality: today.sleepQuality, energy: today.energy, soreness: today.soreness, mood: today.mood, stress: today.stress }
    : DEFAULTS);
  const [sleepHours, setSleepHours] = useState<string>(today?.sleepHours != null ? String(today.sleepHours) : "");
  const [note, setNote] = useState(today?.note ?? "");

  const preview = useMemo(() => computeReadiness({ ...vals, sleepHours: sleepHours ? Number(sleepHours) : null }), [vals, sleepHours]);
  const shown = editing ? preview : (today?.readiness ?? preview);
  const band = readinessBand(shown);

  const submit = () =>
    start(async () => {
      setErr(null);
      const r = await submitCheckin({ ...vals, sleepHours: sleepHours ? Number(sleepHours) : null, note: note || null });
      if (r.ok) { setEditing(false); router.refresh(); } else setErr(r.error);
    });

  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-5 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">Check-in di oggi</div>
          <div className="mt-0.5 text-lg font-semibold">Come stai?</div>
        </div>
        <Ring value={shown} color={BAND_COLOR[band]} />
      </div>

      {!editing && today ? (
        <div className="mt-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)]"><Check className="h-4 w-4" />Fatto · {BAND_LABEL[band]}</div>
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"><Pencil className="h-3.5 w-3.5" />Aggiorna</button>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {WELLNESS_ITEMS.map((it) => (
              <div key={it.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{it.emoji} {it.label}</span>
                  <span className="text-[10px] text-[var(--color-muted)]">{it.invert ? "1 ottimo · 5 pessimo" : "1 basso · 5 alto"}</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = vals[it.key] === n;
                    return (
                      <button key={n} onClick={() => setVals((v) => ({ ...v, [it.key]: n }))}
                        className="rounded-xl border py-2.5 text-sm font-semibold transition-colors"
                        style={active
                          ? { background: "var(--color-accent)", color: "#0a0c10", borderColor: "var(--color-accent)" }
                          : { borderColor: "var(--color-border)", color: "var(--color-muted)" }}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Ore di sonno</span>
                <input value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} inputMode="decimal" placeholder="8"
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">Nota (facolt.)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. ginocchio ok"
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]" />
              </label>
            </div>
          </div>

          {err && <p className="mt-2 text-xs text-[#f87171]">{err}</p>}

          <button disabled={pending} onClick={submit}
            className="mt-4 w-full rounded-2xl bg-[var(--color-accent)] py-3 text-sm font-semibold text-[#0a0c10] disabled:opacity-50">
            {pending ? "Invio…" : today ? "Aggiorna check-in" : "Invia check-in"}
          </button>
        </>
      )}
    </div>
  );
}

function Ring({ value, color }: { value: number; color: string }) {
  const r = 26, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative h-[70px] w-[70px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-border)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset .4s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="num text-lg font-bold" style={{ color }}>{value}</span>
      </div>
    </div>
  );
}

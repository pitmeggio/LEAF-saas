"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateApplicationForm } from "@/app/recruiting-actions";
import { defaultApplicationFields, type ApplicationFieldConfig, type FieldType } from "@/lib/applicationForm";

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";

const CUSTOM_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Paragraph" },
  { value: "email", label: "Email" },
  { value: "url", label: "Link / URL" },
  { value: "tel", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
];

function newKey(existing: Set<string>): string {
  let k = "";
  do {
    k = "q" + Math.random().toString(36).slice(2, 8);
  } while (existing.has(k));
  return k;
}

export function ApplicationFormBuilder({ initial }: { initial: ApplicationFieldConfig[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [fields, setFields] = useState<ApplicationFieldConfig[]>(initial);

  const dirty = () => { setOk(false); setError(null); };
  const update = (key: string, patch: Partial<ApplicationFieldConfig>) => {
    setFields((p) => p.map((f) => (f.key === key ? { ...f, ...patch } : f))); dirty();
  };
  const remove = (key: string) => { setFields((p) => p.filter((f) => f.key !== key)); dirty(); };
  const move = (key: string, dir: -1 | 1) => {
    setFields((p) => {
      const i = p.findIndex((f) => f.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    dirty();
  };
  const addCustom = () => {
    setFields((p) => [
      ...p,
      { key: newKey(new Set(p.map((f) => f.key))), label: "New question", type: "text", enabled: true, required: false, custom: true },
    ]);
    dirty();
  };
  const resetDefault = () => { setFields(defaultApplicationFields()); dirty(); };

  const save = () => {
    setError(null);
    start(async () => {
      const r = await updateApplicationForm(fields);
      if (r.ok) { setOk(true); router.refresh(); } else setError(r.error ?? "Something went wrong");
    });
  };

  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Application form</h2>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Choose which fields applicants see, mark what&apos;s required, and add your own questions. Name, email and the sport-identity fields are always included.
          </p>
        </div>
        <button type="button" onClick={resetDefault} className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
          Reset to default
        </button>
      </div>

      <div className="space-y-2">
        {fields.map((f, i) => (
          <FieldRow
            key={f.key}
            f={f}
            first={i === 0}
            last={i === fields.length - 1}
            onUpdate={(patch) => update(f.key, patch)}
            onRemove={() => remove(f.key)}
            onMove={(dir) => move(f.key, dir)}
          />
        ))}
      </div>

      <button type="button" onClick={addCustom} className="w-full rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]">
        + Add custom question
      </button>

      {error && <p className="text-sm text-[#f87171]">{error}</p>}
      <div className="flex items-center justify-between">
        {ok ? <span className="text-xs text-[#7cff6b]">Saved ✓</span> : <span />}
        <button onClick={save} disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          {pending ? "Saving…" : "Save application form"}
        </button>
      </div>
    </div>
  );
}

function FieldRow({
  f, first, last, onUpdate, onRemove, onMove,
}: {
  f: ApplicationFieldConfig;
  first: boolean;
  last: boolean;
  onUpdate: (patch: Partial<ApplicationFieldConfig>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const locked = !!f.locked;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="flex items-center gap-3">
        {/* Reorder */}
        <div className="flex flex-col">
          <button type="button" onClick={() => onMove(-1)} disabled={first} aria-label="Move up" className="text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-30">▴</button>
          <button type="button" onClick={() => onMove(1)} disabled={last} aria-label="Move down" className="text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-30">▾</button>
        </div>

        {/* Label */}
        <div className="min-w-0 flex-1">
          {f.custom ? (
            <input className={inp} value={f.label} maxLength={120} onChange={(e) => onUpdate({ label: e.target.value })} placeholder="Question label" />
          ) : (
            <div className="text-sm font-medium">
              {f.label}
              {locked && <span className="ml-2 rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Always on</span>}
              {f.custom === false && !locked && <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Standard</span>}
            </div>
          )}
        </div>

        {/* Type (custom only) */}
        {f.custom && (
          <select className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs" value={f.type} onChange={(e) => onUpdate({ type: e.target.value as FieldType })}>
            {CUSTOM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}

        {/* Enabled / Required toggles */}
        <label className={`flex items-center gap-1.5 text-xs ${locked ? "opacity-40" : ""}`}>
          <input type="checkbox" checked={f.enabled} disabled={locked} onChange={(e) => onUpdate({ enabled: e.target.checked })} className="accent-[var(--color-accent)]" />
          Shown
        </label>
        <label className={`flex items-center gap-1.5 text-xs ${locked || !f.enabled ? "opacity-40" : ""}`}>
          <input type="checkbox" checked={f.required} disabled={locked || !f.enabled} onChange={(e) => onUpdate({ required: e.target.checked })} className="accent-[var(--color-accent)]" />
          Required
        </label>

        {/* Remove (custom only) */}
        {f.custom ? (
          <button type="button" onClick={onRemove} aria-label="Remove question" className="text-[var(--color-muted)] hover:text-[#f87171]">✕</button>
        ) : (
          <span className="w-3.5" />
        )}
      </div>

      {/* Dropdown options for custom select fields */}
      {f.custom && f.type === "select" && (
        <div className="mt-2 pl-9">
          <input
            className={`${inp} text-xs`}
            value={(f.options ?? []).join(", ")}
            placeholder="Options, comma-separated (e.g. Yes, No, Maybe)"
            onChange={(e) => onUpdate({ options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
        </div>
      )}
    </div>
  );
}

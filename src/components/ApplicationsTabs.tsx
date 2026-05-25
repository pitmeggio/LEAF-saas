import Link from "next/link";

// Server component — tabs are just URL links (?tab=...). Each tab swaps the
// pane on /dashboard/applications without touching the browser history beyond
// a normal navigation. Keeps Pipeline / Openings & form / Settings on one URL.
export type ApplicationsTabKey = "pipeline" | "openings" | "settings";

const TABS: { key: ApplicationsTabKey; label: string; hint: string }[] = [
  { key: "pipeline", label: "Pipeline", hint: "Kanban board of every candidate" },
  { key: "openings", label: "Openings & form", hint: "Public form, openings, embed snippet" },
  { key: "settings", label: "Recruiting settings", hint: "Public visibility, deadline, eligibility" },
];

export function ApplicationsTabs({ active }: { active: ApplicationsTabKey }) {
  return (
    <div className="border-b border-[var(--color-border)] px-8">
      <div className="-mb-px flex gap-1" role="tablist" aria-label="Applications sections">
        {TABS.map((t) => {
          const isActive = t.key === active;
          // "?tab=pipeline" is the default — leave the URL clean for the default tab.
          const href = t.key === "pipeline" ? "/dashboard/applications" : `/dashboard/applications?tab=${t.key}`;
          return (
            <Link
              key={t.key}
              href={href}
              role="tab"
              aria-selected={isActive}
              title={t.hint}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-[var(--color-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {t.label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-0 h-[2px] rounded-full"
                  style={{ background: "var(--color-accent)" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Server-side normalizer — any unknown / missing value falls back to "pipeline".
export function resolveTab(raw: string | string[] | undefined): ApplicationsTabKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "openings" || v === "settings") return v;
  return "pipeline";
}

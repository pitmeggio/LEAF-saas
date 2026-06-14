"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/auth-actions";
import { LeafMark } from "@/components/LeafMark";
import { SeasonSelector } from "@/components/SeasonSelector";
import { initials } from "@/lib/domain";

type FeatureKey = "featureRecruiting" | "featurePublicProfiles" | "featureFinance" | "featureChat";
type NavItem = {
  href: string;
  label: string;
  icon: string;
  soon?: boolean;
  feature?: FeatureKey;
  // Extra path prefixes that should keep this nav item highlighted. Useful
  // for hub entries (e.g. "Finance") whose sub-pages live at sibling URLs
  // (/dashboard/payments, /dashboard/budgets) rather than nested children.
  activePaths?: string[];
  // Sport-gated entries (e.g. tennis-only court module). Empty = always shown.
  sports?: string[];
};
type NavSection = { label: string; items: NavItem[] };
export type SidebarFeatures = Record<FeatureKey, boolean>;
export type LeafTier = "essential" | "professional" | "complete";

// Grouped navigation — 4 labelled sections instead of one long flat list, so the
// workspace reads as blocks. Items keep their per-tenant feature gating.
// LEAF's 7 modules: Overview + Applications → Athletes → Groups → Finance →
// Performance → Reports → Admin. Recruiting tools (opportunities, form builder,
// publishing) sit inside Applications. Calendar / Season Planner sits under
// Performance since it drives the season-level planning + cost forecast.
//
// PROFESSIONAL tab — the performance + finance workspace. Visible when the
// academy's tier is "professional" or "complete".
const ADMIN_SECTIONS: NavSection[] = [
  { label: "Overview", items: [
    { href: "/dashboard", label: "Overview", icon: "▦" },
  ] },
  { label: "Applications", items: [
    // Single entry — Pipeline / Openings & form / Settings live as tabs
    // inside the Applications page so the workspace stays one module.
    { href: "/dashboard/applications", label: "Applications", icon: "▤", feature: "featureRecruiting" },
  ] },
  { label: "Athletes", items: [
    { href: "/dashboard/athletes", label: "Active Athletes", icon: "⛷" },
    { href: "/dashboard/documents", label: "Documents", icon: "▢" },
  ] },
  { label: "Groups", items: [
    { href: "/dashboard/groups", label: "Groups", icon: "⬡" },
    { href: "/dashboard/coaches", label: "Coaches", icon: "◎" },
  ] },
  { label: "Finance", items: [
    // Single entry — the Finance hub lands on /dashboard/finance and routes
    // out to Payments / Budgets / Expenses / Packages / Reports via a sub-nav
    // so the whole money surface reads as one module. Reports lives here
    // because it's a finance-shaped read-out (collected, outstanding, season
    // P&L) — the standalone sidebar entry was redundant.
    {
      href: "/dashboard/finance",
      label: "Finance",
      icon: "€",
      feature: "featureFinance",
      activePaths: ["/dashboard/finance", "/dashboard/payments", "/dashboard/budgets", "/dashboard/expenses", "/dashboard/packages", "/dashboard/reports"],
    },
  ] },
  { label: "Performance", items: [
    // Ski-shaped season planner — calendar of camps + race plan.
    { href: "/dashboard/calendar", label: "Season Planner", icon: "▣", sports: ["ski"] },
    // Tennis Professional surfaces — cinematic athlete view + tournament-driven planner.
    { href: "/dashboard/canvas", label: "Athlete Canvas", icon: "◐", sports: ["tennis", "padel"] },
    { href: "/dashboard/season", label: "Season View", icon: "≡", sports: ["tennis", "padel"] },
    { href: "/dashboard/tournaments", label: "Tournaments", icon: "◇", sports: ["tennis", "padel"] },
  ] },
  { label: "Admin", items: [
    { href: "/dashboard/inbox", label: "Inbox", icon: "✉", feature: "featureChat" },
    { href: "/dashboard/alerts", label: "Alerts", icon: "△" },
  ] },
];

// ESSENTIAL tab — the booking + Pay-and-Train workspace. The Sport key
// decides which entries appear:
//   • ski → Line Schedule (Trysil's "Treningsskjema" lanes) + Pay-and-Train
//   • tennis → Courts + Pay-and-Train sessions
//   • all → Bookings inbox (incoming reservations)
const ESSENTIAL_ADMIN_SECTIONS: NavSection[] = [
  { label: "Facility", items: [
    { href: "/dashboard/lines", label: "Line Schedule", icon: "≣", sports: ["ski"] },
    { href: "/dashboard/courts", label: "Courts", icon: "◰", sports: ["tennis", "padel"] },
  ] },
  { label: "Pay-and-Train", items: [
    // Ski: Pay-and-Train single sessions. Tennis: summer camps + groups.
    { href: "/dashboard/camps", label: "Camps & Groups", icon: "✦", sports: ["tennis", "padel"] },
    { href: "/dashboard/bookings", label: "Bookings", icon: "📥" },
  ] },
  { label: "Reports", items: [
    { href: "/dashboard/utilization", label: "Reports", icon: "▦" },
  ] },
];

const COACH_SECTIONS: NavSection[] = [
  { label: "Overview", items: [
    { href: "/dashboard", label: "My Dashboard", icon: "▦" },
  ] },
  { label: "Athletes", items: [
    { href: "/dashboard/applications", label: "Applications", icon: "▤", feature: "featureRecruiting" },
    { href: "/dashboard/athletes", label: "My Athletes", icon: "⛷" },
    { href: "/dashboard/documents", label: "Documents", icon: "▢" },
  ] },
  { label: "Groups", items: [
    { href: "/dashboard/groups", label: "My Groups", icon: "⬡" },
  ] },
  { label: "Performance", items: [
    { href: "/dashboard/calendar", label: "Season Planner", icon: "▣" },
  ] },
  { label: "Finance", items: [
    { href: "/dashboard/expenses", label: "My Expenses", icon: "⊟", feature: "featureFinance" },
  ] },
  { label: "Admin", items: [
    { href: "/dashboard/inbox", label: "Inbox", icon: "✉", feature: "featureChat" },
    { href: "/dashboard/alerts", label: "Alerts", icon: "△" },
  ] },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  academy_admin: "Admin",
  coach: "Coach",
  athlete: "Athlete",
  recruiter: "Recruiter",
};

export function Sidebar({ user, features, season, sport, tier }: {
  user: { name: string; role: string; academy: string };
  features: SidebarFeatures;
  season: { active: string; seasons: string[]; isCurrent: boolean };
  // Active sport for this academy — drives the small workspace badge under
  // the brand mark and (eventually) sport-specific entries in this nav.
  sport: { key: string; label: string; short: string; icon: string };
  // Tier decides which workspace tabs the academy can switch between:
  //   "professional" → only Performance OS (Athletes / Coaches / Budget / …)
  //   "essential"    → only Essential OS (Lines / Courts / Pay-and-Train)
  //   "complete"     → both, with a Pro/Essential tab switcher up top
  tier: LeafTier;
}) {
  const pathname = usePathname();
  const isAdmin = user.role === "academy_admin";

  // Decide which workspace is the *default* visible one based on tier.
  // The Essential tab is only an option for admins (coach view is always
  // Professional — coaches don't sell Pay-and-Train slots themselves).
  const hasPro = tier === "professional" || tier === "complete";
  const hasEssential = tier === "essential" || tier === "complete";
  const showTabs = isAdmin && hasPro && hasEssential;

  // Auto-pick the active workspace from the URL so a hard refresh on an
  // Essential page doesn't bounce the sidebar back to Professional.
  const onEssentialPath =
    pathname.startsWith("/dashboard/lines") ||
    pathname.startsWith("/dashboard/courts") ||
    pathname.startsWith("/dashboard/facilities") ||
    pathname.startsWith("/dashboard/sessions") ||
    pathname.startsWith("/dashboard/bookings") ||
    pathname.startsWith("/dashboard/utilization");
  const initialWorkspace: "professional" | "essential" =
    onEssentialPath && hasEssential ? "essential" : hasPro ? "professional" : "essential";
  const [workspace, setWorkspace] = useState<"professional" | "essential">(initialWorkspace);

  // Pick the right section catalogue based on selected workspace.
  const baseSections =
    !isAdmin
      ? COACH_SECTIONS
      : workspace === "essential"
        ? ESSENTIAL_ADMIN_SECTIONS
        : ADMIN_SECTIONS;
  // Hide modules the platform has switched off for this tenant; drop empty sections.
  // Also filter sport-gated items (e.g. "Line Schedule" only for ski).
  const sections = baseSections
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => {
        if (item.feature && !features[item.feature]) return false;
        if (item.sports && !item.sports.includes(sport.key)) return false;
        return true;
      }),
    }))
    .filter((s) => s.items.length > 0);

  const renderItem = (item: NavItem) => {
    // /dashboard must match exactly (otherwise every sub-page matches it).
    // Hub entries (activePaths) light up when the user is on any of their
    // sibling sub-pages, e.g. Finance stays highlighted on /dashboard/payments.
    const candidates = item.activePaths ?? [item.href];
    const active = item.href === "/dashboard"
      ? pathname === "/dashboard"
      : candidates.some((p) => pathname === p || pathname.startsWith(p + "/"));
    return (
      <Link
        key={item.href}
        href={item.soon ? "#" : item.href}
        aria-disabled={item.soon}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
            : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
        } ${item.soon ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <span className="w-4 text-center" style={{ color: active ? "var(--color-accent)" : undefined }}>{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {item.soon && <span className="text-[9px] uppercase tracking-wide">soon</span>}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-5">
      <div className="px-2 pb-4">
        <div className="mb-3 flex items-center gap-2.5">
          <LeafMark size={26} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold leading-tight tracking-tight">LEAF</div>
            <div className="text-[11px] text-[var(--color-muted)] leading-tight">Academy OS</div>
          </div>
        </div>
        {/* Active sport — tells the coach which workspace they're in. The
            label adapts the entire UI downstream (KPIs, columns, AI lens). */}
        <div
          className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]"
          title={`Sport-aware workspace · ${sport.label}`}
        >
          <span aria-hidden>{sport.icon}</span>
          <span className="text-[var(--color-fg)]">{sport.label}</span>
        </div>
        <SeasonSelector active={season.active} seasons={season.seasons} isCurrent={season.isCurrent} />

        {/* Workspace switcher — only rendered when the academy holds both
            LEAF OS Pro AND Essential (tier="complete"). A single-tier
            academy doesn't see the toggle; their one workspace just shows. */}
        {showTabs && (
          <div className="mt-3 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setWorkspace("professional")}
              className={`flex-1 rounded-md px-2 py-1 transition-colors ${
                workspace === "professional"
                  ? "bg-[var(--color-bg)] text-[var(--color-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
              title="Performance + finance + AI"
            >
              Professional
            </button>
            <button
              type="button"
              onClick={() => setWorkspace("essential")}
              className={`flex-1 rounded-md px-2 py-1 transition-colors ${
                workspace === "essential"
                  ? "bg-[var(--color-bg)] text-[var(--color-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
              title="Booking + Pay-and-Train"
            >
              Essential
            </button>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-1">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]/70">{section.label}</div>
            {section.items.map(renderItem)}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center gap-2 px-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: "#7cff6b", color: "#0a0c10" }}
          >
            {(() => {
              const [f = "", l = ""] = user.name.split(" ");
              return initials(f, l).toUpperCase();
            })()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-xs font-medium">{user.name}</div>
            <div className="truncate text-[10px] text-[var(--color-muted)]">
              {ROLE_LABEL[user.role] ?? user.role} · {user.academy}
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              title="Sign out"
              className="rounded-md px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
            >
              ⎋
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

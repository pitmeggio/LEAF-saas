"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import { LeafMark } from "@/components/LeafMark";
import { initials } from "@/lib/domain";

type FeatureKey = "featureRecruiting" | "featurePublicProfiles" | "featureFinance" | "featureChat";
type NavItem = { href: string; label: string; icon: string; soon?: boolean; feature?: FeatureKey };
type NavSection = { label: string; items: NavItem[] };
export type SidebarFeatures = Record<FeatureKey, boolean>;

// Grouped navigation — 4 labelled sections instead of one long flat list, so the
// workspace reads as blocks. Items keep their per-tenant feature gating.
// LEAF's 7 modules: Overview + Applications → Athletes → Groups → Finance →
// Performance → Reports → Admin. Recruiting tools (opportunities, form builder,
// publishing) sit inside Applications. Calendar / Season Planner sits under
// Performance since it drives the season-level planning + cost forecast.
const ADMIN_SECTIONS: NavSection[] = [
  { label: "Overview", items: [
    { href: "/dashboard", label: "Overview", icon: "▦" },
  ] },
  { label: "Applications", items: [
    { href: "/dashboard/applications", label: "Pipeline", icon: "▤", feature: "featureRecruiting" },
    { href: "/dashboard/recruiting", label: "Form & openings", icon: "✦", feature: "featureRecruiting" },
  ] },
  { label: "Athletes", items: [
    { href: "/dashboard/members", label: "Active Athletes", icon: "⛷" },
    { href: "/dashboard/documents", label: "Documents", icon: "▢" },
  ] },
  { label: "Groups", items: [
    { href: "/dashboard/groups", label: "Groups", icon: "⬡" },
    { href: "/dashboard/coaches", label: "Coaches", icon: "◎" },
  ] },
  { label: "Finance", items: [
    { href: "/dashboard/payments", label: "Payments", icon: "€", feature: "featureFinance" },
    { href: "/dashboard/budgets", label: "Budgets", icon: "◧", feature: "featureFinance" },
    { href: "/dashboard/expenses", label: "Expenses", icon: "⊟", feature: "featureFinance" },
    { href: "/dashboard/packages", label: "Packages", icon: "▥" },
  ] },
  { label: "Performance", items: [
    { href: "/dashboard/calendar", label: "Season Planner", icon: "▣" },
  ] },
  { label: "Reports", items: [
    { href: "/dashboard/reports", label: "Reports", icon: "▧", feature: "featureFinance" },
  ] },
  { label: "Admin", items: [
    { href: "/dashboard/inbox", label: "Inbox", icon: "✉", feature: "featureChat" },
    { href: "/dashboard/alerts", label: "Alerts", icon: "△" },
  ] },
];

const COACH_SECTIONS: NavSection[] = [
  { label: "Overview", items: [
    { href: "/dashboard", label: "My Dashboard", icon: "▦" },
  ] },
  { label: "Athletes", items: [
    { href: "/dashboard/applications", label: "Applications", icon: "▤", feature: "featureRecruiting" },
    { href: "/dashboard/members", label: "My Athletes", icon: "⛷" },
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

export function Sidebar({ user, features }: { user: { name: string; role: string; academy: string }; features: SidebarFeatures }) {
  const pathname = usePathname();
  const baseSections = user.role === "academy_admin" ? ADMIN_SECTIONS : COACH_SECTIONS;
  // Hide modules the platform has switched off for this tenant; drop empty sections.
  const sections = baseSections
    .map((s) => ({ ...s, items: s.items.filter((item) => !item.feature || features[item.feature]) }))
    .filter((s) => s.items.length > 0);

  const renderItem = (item: NavItem) => {
    const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
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
      <div className="px-2 pb-6">
        <div className="flex items-center gap-2.5">
          <LeafMark size={26} />
          <div>
            <div className="text-sm font-bold leading-tight tracking-tight">LEAF</div>
            <div className="text-[11px] text-[var(--color-muted)] leading-tight">Academy OS</div>
          </div>
        </div>
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

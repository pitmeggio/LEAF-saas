"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, ClipboardList, Users, FileText, Layers, UserCog, Wallet,
  BarChart3, CalendarDays, Rows3, Trophy, Mail, Bell,
  AlignJustify, Grid2x2, Tent, Inbox, LogOut, Timer, Video, FolderOpen, HeartPulse, type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/auth-actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LeafMark } from "@/components/LeafMark";
import { SeasonSelector } from "@/components/SeasonSelector";
import { initials } from "@/lib/domain";

type FeatureKey = "featureRecruiting" | "featurePublicProfiles" | "featureFinance" | "featureChat";
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
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
  { label: "Panoramica", items: [
    { href: "/dashboard", label: "Panoramica", icon: LayoutDashboard },
  ] },
  { label: "Iscrizioni", items: [
    // Recruiting pipeline — ski/federation flow. Hidden for tennis clubs.
    { href: "/dashboard/applications", label: "Iscrizioni", icon: ClipboardList, feature: "featureRecruiting", sports: ["ski"] },
  ] },
  { label: "Atleti", items: [
    // ONE roster per sport. Tennis lands on the Canvas roster (the real
    // tennis squad lives there via season plans); ski keeps the enrollment
    // list. No separate "Scheda atleta" entry — clicking an athlete opens it.
    { href: "/dashboard/canvas", label: "Atleti", icon: Users, sports: ["tennis", "padel"] },
    { href: "/dashboard/athletes", label: "Atleti", icon: Users, sports: ["ski"] },
    { href: "/dashboard/documents", label: "Documenti", icon: FileText, sports: ["ski"] },
  ] },
  { label: "Gruppi", items: [
    { href: "/dashboard/groups", label: "Gruppi", icon: Layers },
    { href: "/dashboard/coaches", label: "Maestri", icon: UserCog },
  ] },
  { label: "Finanza", items: [
    // Finance hub lands on /dashboard/finance and routes out to Payments /
    // Budgets / Expenses / Packages via a sub-nav. Reports gets its own
    // sub-entry so the season P&L read-out is one click away from anywhere
    // in the sidebar (Pietro: "Reports va sotto voce Finance").
    {
      href: "/dashboard/finance",
      label: "Finanza",
      icon: Wallet,
      feature: "featureFinance",
      activePaths: ["/dashboard/finance", "/dashboard/payments", "/dashboard/budgets", "/dashboard/expenses", "/dashboard/packages"],
    },
    { href: "/dashboard/reports", label: "Report", icon: BarChart3, feature: "featureFinance" },
  ] },
  { label: "Performance", items: [
    // Note: "Programmi" (training/race programmes) is a COACH-only tool — it
    // lives in COACH_SECTIONS, not here. The academy admin doesn't publish
    // sessions, so it's intentionally absent from the admin workspace.
    // Ski-shaped season planner — calendar of camps + race plan.
    // AMS — daily wellness / readiness board (all sports).
    { href: "/dashboard/wellness", label: "Benessere", icon: HeartPulse },
    { href: "/dashboard/calendar", label: "Calendario stagione", icon: CalendarDays, sports: ["ski"] },
    { href: "/dashboard/results", label: "Tempi", icon: Timer, sports: ["ski"] },
    { href: "/dashboard/video", label: "Analisi video", icon: Video, sports: ["ski"] },
    // Tennis Professional surfaces — cinematic athlete view + tournament-driven planner.
    { href: "/dashboard/dossier", label: "Dossier", icon: FolderOpen, sports: ["tennis", "padel"] },
    { href: "/dashboard/season", label: "Vista stagione", icon: Rows3, sports: ["tennis", "padel"] },
    { href: "/dashboard/tournaments", label: "Tornei", icon: Trophy, sports: ["tennis", "padel"] },
  ] },
  { label: "Admin", items: [
    { href: "/dashboard/inbox", label: "Messaggi", icon: Mail, feature: "featureChat" },
    { href: "/dashboard/alerts", label: "Avvisi", icon: Bell },
  ] },
];

// ESSENTIAL tab — the booking + Pay-and-Train workspace. The Sport key
// decides which entries appear:
//   • ski → Line Schedule (Trysil's "Treningsskjema" lanes) + Pay-and-Train
//   • tennis → Courts + Pay-and-Train sessions
//   • all → Bookings inbox (incoming reservations)
const ESSENTIAL_ADMIN_SECTIONS: NavSection[] = [
  { label: "Struttura", items: [
    { href: "/dashboard/lines", label: "Piste", icon: AlignJustify, sports: ["ski"] },
    { href: "/dashboard/courts", label: "Campi", icon: Grid2x2, sports: ["tennis", "padel"] },
  ] },
  { label: "Pay-and-Train", items: [
    // Ski: Pay-and-Train single sessions. Tennis: summer camps + groups.
    { href: "/dashboard/camps", label: "Centri estivi & Gruppi", icon: Tent, sports: ["tennis", "padel"] },
    { href: "/dashboard/bookings", label: "Prenotazioni", icon: Inbox },
    { href: "/dashboard/payments-essential", label: "Pagamenti", icon: Wallet, sports: ["tennis", "padel"] },
  ] },
  { label: "Report", items: [
    { href: "/dashboard/utilization", label: "Report", icon: BarChart3 },
  ] },
];

const COACH_SECTIONS: NavSection[] = [
  { label: "Panoramica", items: [
    { href: "/dashboard", label: "La mia panoramica", icon: LayoutDashboard },
  ] },
  { label: "Atleti", items: [
    { href: "/dashboard/applications", label: "Iscrizioni", icon: ClipboardList, feature: "featureRecruiting" },
    { href: "/dashboard/athletes", label: "I miei atleti", icon: Users },
    { href: "/dashboard/documents", label: "Documenti", icon: FileText },
  ] },
  { label: "Gruppi", items: [
    { href: "/dashboard/groups", label: "I miei gruppi", icon: Layers },
  ] },
  { label: "Performance", items: [
    { href: "/dashboard/programs", label: "Programmi", icon: ClipboardList },
    { href: "/dashboard/wellness", label: "Benessere", icon: HeartPulse },
    { href: "/dashboard/calendar", label: "Calendario stagione", icon: CalendarDays, sports: ["ski"] },
    { href: "/dashboard/results", label: "Tempi", icon: Timer, sports: ["ski"] },
    { href: "/dashboard/video", label: "Analisi video", icon: Video, sports: ["ski"] },
  ] },
  { label: "Finanza", items: [
    { href: "/dashboard/expenses", label: "Le mie spese", icon: Wallet, feature: "featureFinance" },
  ] },
  { label: "Admin", items: [
    { href: "/dashboard/inbox", label: "Messaggi", icon: Mail, feature: "featureChat" },
    { href: "/dashboard/alerts", label: "Avvisi", icon: Bell },
  ] },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  academy_admin: "Admin",
  coach: "Coach",
  athlete: "Atleta",
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
    pathname.startsWith("/dashboard/payments-essential") ||
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
        <item.icon
          className="h-[18px] w-[18px] shrink-0 transition-colors"
          strokeWidth={active ? 2.25 : 1.75}
          style={{ color: active ? "var(--color-accent)" : "currentColor" }}
          aria-hidden
        />
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
          {/* Apple-style appearance toggle — sun/moon, top-right of the
              brand row so the user can flip light/dark at a glance. */}
          <ThemeToggle />
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
              className="flex items-center justify-center rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

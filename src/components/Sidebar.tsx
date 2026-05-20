"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import { initials } from "@/lib/domain";

const ADMIN_NAV = [
  { href: "/", label: "Overview", icon: "▦" },
  { href: "/inbox", label: "Inbox", icon: "✉" },
  { href: "/applications", label: "Applications", icon: "▤" },
  { href: "/members", label: "Active Athletes", icon: "⛷" },
  { href: "/groups", label: "Groups", icon: "⬡" },
  { href: "/coaches", label: "Coaches", icon: "◎" },
  { href: "/packages", label: "Packages", icon: "▥" },
  { href: "/payments", label: "Payments", icon: "€" },
  { href: "/expenses", label: "Expenses", icon: "⊟" },
  { href: "/reports", label: "Reports", icon: "▧" },
  { href: "/documents", label: "Documents", icon: "▢" },
  { href: "/alerts", label: "Alerts", icon: "△" },
  { href: "/settings", label: "Settings", icon: "⚙", soon: true },
];

const COACH_NAV = [
  { href: "/", label: "My Dashboard", icon: "▦" },
  { href: "/inbox", label: "Inbox", icon: "✉" },
  { href: "/applications", label: "Applications", icon: "▤" },
  { href: "/members", label: "My Athletes", icon: "⛷" },
  { href: "/groups", label: "My Groups", icon: "⬡" },
  { href: "/documents", label: "Documents", icon: "▢" },
  { href: "/alerts", label: "Alerts", icon: "△" },
  { href: "/expenses", label: "My Expenses", icon: "⊟" },
];

const ROLE_LABEL: Record<string, string> = {
  academy_admin: "Admin",
  coach: "Coach",
  athlete: "Athlete",
  recruiter: "Recruiter",
};

export function Sidebar({ user }: { user: { name: string; role: string; academy: string } }) {
  const pathname = usePathname();
  const NAV = user.role === "academy_admin" ? ADMIN_NAV : COACH_NAV;
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-5">
      <div className="px-2 pb-6">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg font-black"
            style={{ background: "var(--color-accent)", color: "#0a0c10" }}
          >
            A
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Apex</div>
            <div className="text-[11px] text-[var(--color-muted)] leading-tight">Academy OS</div>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
              <span className="w-4 text-center" style={{ color: active ? "var(--color-accent)" : undefined }}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.soon && <span className="text-[9px] uppercase tracking-wide">soon</span>}
            </Link>
          );
        })}
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

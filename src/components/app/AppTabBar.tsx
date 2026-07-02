"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Bottom tab bar for the LEAF athlete app — the native-app feel on phone.
// Fixed to the bottom, constrained to the app column so it sits inside the
// phone frame on desktop too. Active tab lights up in the accent colour.
// The Bacheca tab carries an unread badge (drives daily open-rate).
const TABS = [
  { href: "/app", label: "Home", icon: "▦" },
  { href: "/app/board", label: "Bacheca", icon: "🔔", badge: true },
  { href: "/app/wellness", label: "Benessere", icon: "❤" },
  { href: "/app/training", label: "Allenamenti", icon: "▣" },
  { href: "/app/profile", label: "Profilo", icon: "⛷" },
];

export function AppTabBar({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
      <div className="grid grid-cols-5 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
        {TABS.map((t) => {
          const active = t.href === "/app" ? pathname === "/app" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="relative flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors"
              style={{ color: active ? "var(--color-accent)" : "var(--color-muted)" }}
            >
              <span className="relative text-lg leading-none">
                {t.icon}
                {t.badge && unread > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[9px] font-bold text-[#0a0c10]">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

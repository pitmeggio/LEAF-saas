import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";

// Shared footer across the public LEAF site.
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-5 py-12 md:px-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <LeafMark size={26} />
              <span className="text-lg font-bold tracking-tight">LEAF</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-[var(--color-muted)]">
              The verified performance intelligence layer for elite sport — athlete profiles, AI analytics and the academy OS.
            </p>
          </div>

          <FooterCol title="For athletes" links={[
            { label: "Create your profile", href: "/explore" },
            { label: "Explore LEAF", href: "/explore" },
            { label: "Athlete sign in", href: "/login/athlete" },
          ]} />

          <FooterCol title="For academies" links={[
            { label: "Bring your academy", href: "/request" },
            { label: "Academy & coach sign in", href: "/login" },
          ]} />

          <FooterCol title="Platform" links={[
            { label: "Privacy & data terms", href: "/privacy" },
          ]} />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-[var(--color-border)] pt-6 text-xs text-[var(--color-muted)] sm:flex-row">
          <span>© {year} LEAF · The performance intelligence layer for elite sport</span>
          <span className="flex items-center gap-1.5"><LeafMark size={14} variant="currentColor" /> Built for academies, clubs & federations</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="kicker mb-3">{title}</div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

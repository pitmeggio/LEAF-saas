import Link from "next/link";
import { signOut } from "@/app/auth-actions";
import { requireSuperAdmin } from "@/lib/auth";
import { getPendingRequestCount } from "@/lib/superadmin";
import { LeafMark } from "@/components/LeafMark";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSuperAdmin();
  const pendingRequests = await getPendingRequestCount();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-6 py-3.5 backdrop-blur">
        <div className="flex items-center gap-6">
          <Link href="/super-admin" className="flex items-center gap-2.5">
            <LeafMark size={26} />
            <div className="leading-tight">
              <div className="text-sm font-bold">LEAF Platform</div>
              <div className="text-[11px] text-[var(--color-muted)]">Super Admin</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/super-admin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]">Academies</Link>
            <Link href="/super-admin/requests" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]">
              Requests
              {pendingRequests > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "#f59e0b", color: "#0a0c10" }}>{pendingRequests}</span>
              )}
            </Link>
            <Link href="/super-admin/people" className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]">People</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[var(--color-muted)]">{s.name}</span>
          <form action={signOut}>
            <button type="submit" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface)]">Sign out</button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

import { signOut } from "@/app/auth-actions";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSuperAdmin();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-6 py-3.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg font-black" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>A</div>
          <div className="leading-tight">
            <div className="text-sm font-bold">LEAF Platform</div>
            <div className="text-[11px] text-[var(--color-muted)]">Super Admin</div>
          </div>
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { getCurrentUser } from "@/lib/auth";
import { academyFeatures } from "@/lib/plans";
import { getSeasonContext } from "@/lib/season-server";
import { getSportModuleForAcademy } from "@/lib/sports/registry";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Platform owners don't have a tenant workspace — send them to the portal.
  if (user.role === "super_admin") redirect("/super-admin");
  // Athletes have their own workspace, not the academy dashboard.
  if (user.role === "athlete") redirect("/me");

  // Deactivated tenant: lock the whole workspace behind a notice (super admin can re-enable it).
  if (user.academy && user.academy.status !== "active") {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="card max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f8717120] text-[#f87171]">⏸</div>
          <h1 className="text-lg font-bold">Account suspended</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {user.academy.name} is currently deactivated. Please contact your platform administrator to restore access.
          </p>
          <Link href="/login" className="mt-6 inline-block rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-surface)]">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  const season = await getSeasonContext();

  // Sport-aware workspace — the active sport module drives sport-specific
  // labels, KPIs, list columns, AI keyword maps and public-profile metrics.
  // Falls back to the platform default (ski) when an academy hasn't picked
  // a sport yet, so nothing crashes during transitions.
  const sport = getSportModuleForAcademy(user.academy);

  return (
    <>
      <Sidebar
        user={{ name: user.name, role: user.role, academy: user.academy?.name ?? "—" }}
        features={academyFeatures(user.academy)}
        season={season}
        sport={{ key: sport.key, label: sport.label, short: sport.short, icon: sport.icon }}
        tier={
          (user.academy?.tier === "essential" || user.academy?.tier === "complete"
            ? user.academy.tier
            : "professional") as "essential" | "professional" | "complete"
        }
      />
      <main className="ml-60 min-h-screen">{children}</main>
    </>
  );
}

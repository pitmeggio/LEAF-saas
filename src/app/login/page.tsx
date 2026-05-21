import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { LeafMark } from "@/components/LeafMark";

export const dynamic = "force-dynamic";

const FEATURES = [
  { title: "Athlete Operations", desc: "Applications, enrollments and verified sports CVs." },
  { title: "Academy Management", desc: "Groups, coaches, packages and documents." },
  { title: "Finance & Payments", desc: "Schedules, invoices, budgets and forecasts." },
  { title: "Performance Tracking", desc: "FIS trends, results and athlete development." },
];

export default async function LoginPage() {
  // The sign-in form must always be reachable, so a DB outage must never 500 this page.
  // We read the session in a try/catch (redirect() is called OUTSIDE the catch so its
  // internal throw isn't swallowed). Already signed in → go straight to the app.
  let signedIn = false;
  try {
    signedIn = !!(await getCurrentUser());
  } catch {
    signedIn = false;
  }
  if (signedIn) redirect("/dashboard");

  // Demo accounts are a convenience; if the DB is unreachable, still render the form.
  let demoUsers: { id: string; name: string; role: string; email: string }[] = [];
  try {
    demoUsers = await prisma.user.findMany({ orderBy: { role: "asc" }, select: { id: true, name: true, role: true, email: true } });
  } catch {
    demoUsers = [];
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — brand / product */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-surface)] p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 20% 20%, var(--color-accent) 0, transparent 40%), radial-gradient(circle at 80% 60%, #38bdf8 0, transparent 45%)" }}
        />
        <div className="relative flex items-center gap-3">
          <LeafMark size={34} />
          <span className="text-lg font-bold tracking-tight">LEAF <span className="font-medium text-[var(--color-muted)]">Academy OS</span></span>
        </div>

        <div className="relative">
          <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            Manage athletes, coaches, finance and performance in one system.
          </h1>
          <div className="mt-10 grid max-w-md grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-4">
                <div className="text-sm font-semibold">{f.title}</div>
                <div className="mt-1 text-xs text-[var(--color-muted)]">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-[var(--color-muted)]">Premium operating system for sports academies, clubs and federations.</div>
      </div>

      {/* Right — sign in */}
      <div className="flex items-center justify-center p-8">
        {/* Mobile brand */}
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LeafMark size={30} />
            <span className="font-bold tracking-tight">LEAF</span>
          </div>
          <LoginForm demoUsers={demoUsers} />
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LoginChooser } from "@/components/LoginChooser";
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
      {/* Left — brand / product (command-center backdrop) */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-bg)] p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-[-80px] top-[20%] h-[360px] w-[480px] glow-accent" />
        {/* faint analytics line */}
        <svg className="pointer-events-none absolute bottom-0 left-0 w-full opacity-[0.18]" viewBox="0 0 600 200" fill="none" preserveAspectRatio="none">
          <polyline points="0,170 90,150 170,158 250,120 330,128 410,80 500,92 600,40" stroke="var(--color-accent)" strokeWidth="2.5" />
        </svg>

        <Link href="/" className="relative flex items-center gap-3 transition-opacity hover:opacity-80">
          <LeafMark size={34} />
          <span className="text-lg font-bold tracking-tight">LEAF</span>
        </Link>

        <div className="relative">
          <div className="kicker mb-4" style={{ color: "var(--color-accent)" }}>Sports Performance OS</div>
          <h1 className="display max-w-md text-4xl font-bold">
            The command center for elite athlete performance.
          </h1>
          <div className="mt-9 grid max-w-md grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-2 p-4">
                <div className="text-sm font-semibold">{f.title}</div>
                <div className="mt-1 text-xs text-[var(--color-muted)]">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative kicker">For athletes · academies · clubs · federations</div>
      </div>

      {/* Right — sign in */}
      <div className="flex items-center justify-center p-8">
        {/* Mobile brand */}
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LeafMark size={30} />
            <span className="font-bold tracking-tight">LEAF</span>
          </Link>
          <LoginChooser demoUsers={demoUsers} />
        </div>
      </div>
    </div>
  );
}

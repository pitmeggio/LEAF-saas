import { redirect } from "next/navigation";
import { getCurrentUser, homeForRole } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { LeafMark } from "@/components/LeafMark";

export const dynamic = "force-dynamic";
export const metadata = { title: "Athlete sign in — LEAF" };

export default async function AthleteLoginPage() {
  // Already signed in → straight to the right home (athletes → /me).
  let role: string | null = null;
  try {
    const u = await getCurrentUser();
    role = u?.role ?? null;
  } catch {
    role = null;
  }
  if (role) redirect(homeForRole(role));

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — athlete brand */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-bg)] p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="pointer-events-none absolute left-[-80px] top-[20%] h-[360px] w-[480px] glow-accent" />
        <div className="relative flex items-center gap-3">
          <LeafMark size={34} />
          <span className="text-lg font-bold tracking-tight">LEAF</span>
        </div>
        <div className="relative">
          <div className="kicker mb-4" style={{ color: "var(--color-accent)" }}>For athletes</div>
          <h1 className="display max-w-md text-4xl font-bold">Your performance, your profile.</h1>
          <p className="mt-4 max-w-md text-sm text-[var(--color-muted)]">
            Sign in to manage your verified profile, see your AI insights and forecast, and share your link with academies.
          </p>
        </div>
        <div className="relative kicker">Verified · AI-analysed · owned by you</div>
      </div>

      {/* Right — athlete sign in */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LeafMark size={30} />
            <span className="font-bold tracking-tight">LEAF</span>
          </div>
          <LoginForm demoUsers={[]} variant="athlete" />
        </div>
      </div>
    </div>
  );
}

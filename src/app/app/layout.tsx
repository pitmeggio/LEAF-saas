import { requireAthleteId } from "@/lib/auth";
import { AppTabBar } from "@/components/app/AppTabBar";
import { countUnread } from "@/lib/board/board";

export const dynamic = "force-dynamic";

// LEAF APP — the athlete's mobile home. A phone-width column (centered on
// desktop so the preview looks like a real device) with a fixed bottom tab
// bar. Guarded for athletes only; academy roles live in the OS (/dashboard).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const athleteId = await requireAthleteId(); // athletes only — redirects everyone else to their home
  const unread = await countUnread(athleteId);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[480px] border-x border-[var(--color-border)] pb-24">
      {children}
      <AppTabBar unread={unread} />
    </div>
  );
}

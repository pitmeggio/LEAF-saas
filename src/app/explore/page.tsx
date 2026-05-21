import { getPublicAcademiesDirectory, getPublicAthletesDirectory } from "@/lib/profiles";
import { PublicNav } from "@/components/PublicNav";
import { ExploreBrowser } from "@/components/ExploreBrowser";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explore — LEAF" };

export default async function ExplorePage() {
  const [academies, athletes] = await Promise.all([getPublicAcademiesDirectory(), getPublicAthletesDirectory()]);

  return (
    <div className="min-h-screen">
      <PublicNav active="explore" />
      <ExploreBrowser academies={academies} athletes={athletes} />
      <footer className="border-t border-[var(--color-border)] px-5 py-6 text-center text-xs text-[var(--color-muted)] md:px-12">
        Powered by LEAF · Academy OS + Athlete Profiles
      </footer>
    </div>
  );
}

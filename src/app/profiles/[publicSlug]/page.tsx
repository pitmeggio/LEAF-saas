import { redirect } from "next/navigation";

// Backward compatibility: the athlete profile moved to /athlete/[athleteSlug].
export default async function LegacyProfileRedirect({ params }: { params: Promise<{ publicSlug: string }> }) {
  const { publicSlug } = await params;
  redirect(`/athlete/${publicSlug}`);
}

import { redirect } from "next/navigation";

// Recruiting was folded into Applications as a tab. Old bookmarks land on the
// closest equivalent — the Openings & form tab — so the user sees the same
// surface (opportunities, form builder, public embed) they expected.
export default function RecruitingRedirect() {
  redirect("/dashboard/applications?tab=openings");
}

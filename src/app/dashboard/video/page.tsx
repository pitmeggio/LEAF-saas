import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import VideoCompare from "@/components/VideoCompare";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VideoPage() {
  const s = await getSession();
  if (!s?.academyId) redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="Analisi video"
        subtitle="Confronta due clip fianco a fianco — scrub fotogramma per fotogramma, sincronizza l'allineamento ed esporta. I video restano sul tuo dispositivo, niente upload."
      />
      <div className="p-8">
        <VideoCompare />
      </div>
    </>
  );
}

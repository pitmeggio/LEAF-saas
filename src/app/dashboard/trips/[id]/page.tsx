import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getTripDetail, getRosterOptions } from "@/lib/trips/trips";
import { TripDetailManager } from "@/components/TripDetailManager";
import { DeleteTripButton } from "@/components/DeleteTripButton";
import { tripDateLabel } from "@/lib/trips/tripTypes";

export const dynamic = "force-dynamic";

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.isSuperAdmin) redirect("/super-admin");
  if (s.isAthlete) redirect("/app");
  const { id } = await params;

  const [trip, roster] = await Promise.all([getTripDetail(s.academyId!, id), getRosterOptions(s.academyId!)]);
  if (!trip) notFound();

  return (
    <div className="p-8">
      <Link href="/dashboard/trips" className="mb-4 inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"><ArrowLeft className="h-3.5 w-3.5" />Trasferte</Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{trip.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {tripDateLabel(trip.startDate, trip.endDate)}
            {trip.location ? <> · <MapPin className="inline h-3.5 w-3.5" /> {trip.location}</> : ""}
            {trip.zone ? ` · ${trip.zone}` : ""}
          </p>
          {trip.notes && <p className="mt-1 text-xs text-[var(--color-muted)]">{trip.notes}</p>}
        </div>
        <DeleteTripButton id={trip.id} />
      </div>

      <TripDetailManager trip={trip} roster={roster} />
    </div>
  );
}

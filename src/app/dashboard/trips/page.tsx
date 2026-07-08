import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/auth";
import { getTrips } from "@/lib/trips/trips";
import { getAcademyCurrency } from "@/lib/ops";
import { TripCreateButton } from "@/components/TripCreateButton";
import { tripDateLabel } from "@/lib/trips/tripTypes";
import { Plane, Users, MapPin, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

function money(v: number, currency: string): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

// Trasferte — named away-trips with shared-cost splitting. Any staff (admin /
// office / coach) can create one and manage participants + expenses.
export default async function TripsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.isSuperAdmin) redirect("/super-admin");
  if (s.isAthlete) redirect("/app");

  const [trips, currency] = await Promise.all([getTrips(s.academyId!), getAcademyCurrency()]);

  return (
    <>
      <PageHeader title="Trasferte" subtitle="Gruppi temporanei per tornei e blocchi — con divisione delle spese." />
      <div className="space-y-6 p-8">
        <TripCreateButton />

        {trips.length === 0 ? (
          <div className="card p-10 text-center text-sm text-[var(--color-muted)]">
            Nessuna trasferta. Creane una (es. <span className="font-medium">Kufstein 18–21 lug</span>): aggiungi i partecipanti, anche di altri maestri o fuori rosa, e registra le spese da dividere.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t) => (
              <Link key={t.id} href={`/dashboard/trips/${t.id}`} className="card card-hover group p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Plane className="h-4 w-4 text-[var(--color-accent)]" /><span className="font-semibold">{t.name}</span></div>
                  <ArrowRight className="h-4 w-4 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-1 text-[11px] text-[var(--color-muted)]">
                  {tripDateLabel(t.startDate, t.endDate)}{t.location ? <> · <MapPin className="inline h-3 w-3" /> {t.location}</> : ""}{t.zone ? ` · ${t.zone}` : ""}
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)]"><Users className="h-3.5 w-3.5" />{t.memberCount} partecipanti</div>
                  <div className="text-right">
                    <div className="num text-lg font-bold">{money(t.total, currency)}</div>
                    {t.memberCount > 0 && <div className="text-[10px] text-[var(--color-muted)]">{money(t.perHead, currency)} a testa</div>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

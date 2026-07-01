import { PageHeader } from "@/components/PageHeader";
import { requireAcademyId } from "@/lib/auth";
import { getEssentialPayments } from "@/lib/payments/essential";
import { paymentsConfigured } from "@/lib/payments/stripe";
import { PayablesManager } from "@/components/PayablesManager";

export const dynamic = "force-dynamic";

// LEAF OS Essential — Pagamenti. Every payable item (camp registrations + priced
// court bookings) with paid / to-pay, a Stripe payment link (Apple Pay included)
// and a manual "segna incassato" for cash/bank.
export default async function EssentialPaymentsPage() {
  const academyId = await requireAcademyId();
  const data = await getEssentialPayments(academyId, paymentsConfigured());

  return (
    <>
      <PageHeader
        title="Pagamenti"
        subtitle="Iscrizioni ai camp e prenotazioni campi — incassa online (Apple Pay, carte) o segna a mano."
      />
      <div className="p-8">
        <PayablesManager data={data} />
      </div>
    </>
  );
}

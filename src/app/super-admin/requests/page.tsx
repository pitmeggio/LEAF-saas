import { getAcademyRequests } from "@/lib/superadmin";
import { COUNTRY, fmtDate } from "@/lib/domain";
import { ReviewRequestButton, RequestStatusBadge } from "@/components/SuperAdminRequests";

export const dynamic = "force-dynamic";

export default async function SuperAdminRequestsPage() {
  const requests = await getAcademyRequests();
  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Onboarding requests</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {pending.length} pending · review and provision academies that want to join LEAF.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="card p-10 text-center text-sm text-[var(--color-muted)]">No requests yet.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold">{r.academyName}</span>
                    <RequestStatusBadge status={r.status} />
                    <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] font-semibold">{r.plan}</span>
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-muted)]">
                    {r.contactName} · {r.email}{r.phone ? ` · ${r.phone}` : ""}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                    {COUNTRY[r.country]?.flag} {r.location ?? COUNTRY[r.country]?.name ?? r.country} · {r.sport} · requested {fmtDate(r.createdAt)}
                  </div>
                  {r.message && <p className="mt-3 max-w-2xl text-sm text-[var(--color-fg)]/85">{r.message}</p>}
                  {r.reviewerNote && <p className="mt-2 text-xs text-[var(--color-muted)]">Note: {r.reviewerNote}</p>}
                </div>
                <div className="shrink-0">
                  {r.status === "pending"
                    ? <ReviewRequestButton request={{ id: r.id, academyName: r.academyName, plan: r.plan }} />
                    : r.provisionedAcademyId
                      ? <span className="text-xs text-[var(--color-muted)]">Provisioned ✓</span>
                      : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

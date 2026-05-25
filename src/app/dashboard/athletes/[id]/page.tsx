import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, TrendArrow, Verified } from "@/components/ui";
import { Dot } from "@/components/StatCard";
import { GrowthChart, type Point } from "@/components/GrowthChart";
import { ManagePanel, NotesEditor, PaymentControl, DocumentControl } from "@/components/MemberControls";
import { PublicProfilePanel } from "@/components/PublicProfilePanel";
import { ContractsPanel } from "@/components/ContractsPanel";
import { CoachIntelligencePanel } from "@/components/CoachIntelligencePanel";
import { TennisProfileCard } from "@/components/TennisProfileCard";
import { TennisMatchesPanel } from "@/components/TennisMatchesPanel";
import { Modal, AthleteEditForm, DeleteButton } from "@/components/EntityForms";
import { deriveLevelSuggestions, type AthleteAiProfile } from "@/lib/ai/coachProfile";
import { getActiveAthlete, getAssignmentOptions, getNotifications } from "@/lib/ops";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NOTIF_LABEL } from "@/lib/notifications";
import {
  DISCIPLINE_LABEL, COUNTRY, LEVEL_LABEL, age, fmtDate, fmtPoints, fmtMoney,
  ENROLLMENT_STATUS_COLOR, PERF_COLOR, PAYMENT_STATUS_COLOR, DOC_STATUS_COLOR,
  effectivePaymentStatus, perfFromTrend,
} from "@/lib/domain";
import { DOC_LABEL } from "@/lib/enrollmentLogic";

export const dynamic = "force-dynamic";

export default async function MemberProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  const m = await getActiveAthlete(id, s?.isAdmin ? null : s?.coachId ?? null);
  if (!m) notFound();
  const [opts, notifications] = await Promise.all([getAssignmentOptions(), getNotifications({ enrollmentId: id })]);
  const a = m.athlete;
  const academy = s?.academyId
    ? await prisma.academy.findUnique({ where: { id: s.academyId }, select: { currency: true, featurePublicProfiles: true } })
    : null;
  const currency = academy?.currency ?? "EUR";
  // Public-profile UI (chips in the hero + the PublicProfilePanel on the
  // right) only renders when the platform has enabled the feature for this
  // academy. With the marketplace not live yet, default is OFF — surface
  // stays clean and honest.
  const publicProfilesEnabled = academy?.featurePublicProfiles ?? false;
  const chart: Point[] = a.rankings.map((r) => ({ label: new Date(r.date).toLocaleDateString("en-GB", { month: "short" }), fisPoints: r.fisPoints }));
  const perf = perfFromTrend(m.trend);

  return (
    <>
      <PageHeader
        title="Active athlete"
        subtitle={`Joined ${fmtDate(m.joinDate)} · ${m.level ? LEVEL_LABEL[m.level] : "—"}`}
        right={<Link href="/dashboard/athletes" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">← Active athletes</Link>}
      />

      <div className="grid gap-6 p-8 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Hero */}
          <div className="card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar first={a.firstName} last={a.lastName} color={a.photoColor} size={72} />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold">{a.firstName} {a.lastName}</h2>
                  {a.verified && <Verified />}
                  {a.injuryFlag && <span className="rounded-md bg-[#f8717120] px-2 py-0.5 text-[10px] font-semibold text-[#f87171]">INJURED</span>}
                </div>
                <div className="mt-1 text-sm text-[var(--color-muted)]">
                  {COUNTRY[a.nationality]?.flag} {COUNTRY[a.nationality]?.name} · {age(a.dob)}y · {DISCIPLINE_LABEL[a.discipline]}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium capitalize" style={{ background: `${ENROLLMENT_STATUS_COLOR[m.status]}1a`, color: ENROLLMENT_STATUS_COLOR[m.status] }}>
                  <Dot color={ENROLLMENT_STATUS_COLOR[m.status]} /> {m.status}
                </span>
                {/* Public profile shortcut — only rendered when the platform
                    has enabled the feature for this academy. With the
                    marketplace not live yet, the flag defaults to OFF; super
                    admin flips it on for showcase / early-adopter tenants. */}
                {publicProfilesEnabled && a.publicProfileEnabled && a.publicSlug ? (
                  <Link
                    href={`/athlete/${a.publicSlug}`}
                    target="_blank"
                    rel="noopener"
                    className="rounded-lg border border-[#7CFF6B40] bg-[#7cff6b0c] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[#7cff6b14]"
                  >
                    Public profile ↗
                  </Link>
                ) : publicProfilesEnabled ? (
                  <span
                    title="Public profile is off — turn it on in the Public profile panel on the right."
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)]"
                  >
                    Public profile off
                  </span>
                ) : null}
                {m.conversations[0] && <Link href={`/dashboard/inbox/${m.conversations[0].id}`} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">✉ Chat</Link>}
                <Modal label="Edit" title="Edit athlete" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
                  <AthleteEditForm athlete={{
                    id: a.id, firstName: a.firstName, lastName: a.lastName, email: a.email, phone: a.phone,
                    nationality: a.nationality, discipline: a.discipline,
                    emergencyContact: a.emergencyContact, guardianName: a.guardianName, guardianContact: a.guardianContact,
                    // Sport-adaptive tennis fields — only rendered when sport === "tennis".
                    sport: a.sport,
                    dominantHand: a.dominantHand, playingStyle: a.playingStyle,
                    technicalLevel: a.technicalLevel, tacticalLevel: a.tacticalLevel,
                    physicalLevel: a.physicalLevel, mentalLevel: a.mentalLevel,
                    developmentGoals: a.developmentGoals,
                  }} />
                </Modal>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Performance</h3>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium capitalize" style={{ color: PERF_COLOR[perf] }}>
                <Dot color={PERF_COLOR[perf]} /> {perf}
              </span>
            </div>
            {chart.length > 1 ? <GrowthChart data={chart} /> : (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-muted)]">No FIS history yet.</div>
            )}
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <Mini label="FIS points" value={fmtPoints(a.fisPoints)} />
              <Mini label="World rank" value={a.worldRank != null ? String(a.worldRank) : "—"} />
              <Mini label="Team avg" value={fmtPoints(m.teamAvg)} sub={a.fisPoints != null && m.teamAvg != null ? (a.fisPoints <= m.teamAvg ? "above avg" : "below avg") : undefined} />
            </div>
          </div>

          {/* Tennis profile — only when sport === "tennis". Ski athletes keep
              the FIS-driven Performance card above as their primary profile. */}
          {a.sport === "tennis" && (
            <TennisProfileCard
              profile={{
                dominantHand: a.dominantHand,
                playingStyle: a.playingStyle,
                technicalLevel: a.technicalLevel,
                tacticalLevel: a.tacticalLevel,
                physicalLevel: a.physicalLevel,
                mentalLevel: a.mentalLevel,
                developmentGoals: a.developmentGoals,
              }}
              suggestions={deriveLevelSuggestions(
                (a.aiProfile as unknown as AthleteAiProfile | null) ?? null,
                {
                  technical: a.technicalLevel,
                  tactical: a.tacticalLevel,
                  physical: a.physicalLevel,
                  mental: a.mentalLevel,
                },
              )}
            />
          )}

          {a.sport === "tennis" && s?.academyId && (
            <TennisMatchesPanel athleteId={a.id} academyId={s.academyId} />
          )}

          {/* Coach Intelligence — adaptive notes + living AI profile */}
          {s?.academyId && (
            <CoachIntelligencePanel
              athleteId={a.id}
              academyId={s.academyId}
              sport={m.group?.sport ?? a.sport ?? "ski"}
              canDeleteAuthorId={s.userId ?? null}
              isAdmin={s.isAdmin ?? false}
            />
          )}

          {/* Recent results */}
          <div className="card overflow-hidden">
            <div className="border-b border-[var(--color-border)] px-5 py-4"><h3 className="text-sm font-semibold">Recent results</h3></div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <th className="px-5 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Event</th><th className="px-3 py-3 font-medium">Rank</th><th className="px-3 py-3 font-medium">FIS</th>
              </tr></thead>
              <tbody>
                {a.results.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-border)]">
                    <td className="px-5 py-3 text-[var(--color-muted)]">{fmtDate(r.date)}</td>
                    <td className="px-3 py-3">{r.eventName}</td>
                    <td className="num px-3 py-3 font-semibold">{r.rank}</td>
                    <td className="num px-3 py-3">{r.fisPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payments */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
              <h3 className="text-sm font-semibold">Payments</h3>
              <span className="text-xs text-[var(--color-muted)]">{fmtMoney(m.paidTotal, currency)} / {fmtMoney(m.paymentsTotal, currency)} paid · <span style={{ color: m.outstanding > 0 ? "#f59e0b" : undefined }}>{fmtMoney(m.outstanding, currency)} outstanding</span></span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {m.payments.length === 0 && <tr><td className="px-5 py-4 text-sm text-[var(--color-muted)]">No payments scheduled.</td></tr>}
                {m.payments.map((p) => {
                  const st = effectivePaymentStatus(p);
                  return (
                    <tr key={p.id} className="border-t border-[var(--color-border)]">
                      <td className="px-5 py-3">{p.label}</td>
                      <td className="num px-3 py-3">{fmtMoney(p.amount, p.currency)}{p.paidAmount > 0 && p.paidAmount < p.amount && <span className="text-xs text-[var(--color-muted)]"> · {fmtMoney(p.paidAmount)} paid</span>}</td>
                      <td className="px-3 py-3 text-xs text-[var(--color-muted)]">due {fmtDate(p.dueDate)}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize" style={{ color: PAYMENT_STATUS_COLOR[st] }}>
                          <Dot color={PAYMENT_STATUS_COLOR[st]} /> {st}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right"><PaymentControl paymentId={p.id} status={p.status} amount={p.amount} paidAmount={p.paidAmount} currency={p.currency} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Documents */}
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-semibold">Documents</h3>
            <div className="space-y-2">
              {m.documents.map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
                  <span className="text-sm">{DOC_LABEL[doc.type] ?? doc.type}</span>
                  <DocumentControl documentId={doc.id} status={doc.status} expiresAt={doc.expiresAt ? new Date(doc.expiresAt).toISOString().slice(0, 10) : null} />
                </div>
              ))}
            </div>
          </div>

          {/* Invoices */}
          {m.invoices.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-[var(--color-border)] px-5 py-4"><h3 className="text-sm font-semibold">Invoices</h3></div>
              <table className="w-full text-sm">
                <tbody>
                  {m.invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-[var(--color-border)] first:border-t-0">
                      <td className="num px-5 py-3">{inv.number}</td>
                      <td className="num px-3 py-3">{fmtMoney(inv.amount, inv.currency)}</td>
                      <td className="px-3 py-3 text-xs text-[var(--color-muted)]">{inv.paidAt ? `paid ${fmtDate(inv.paidAt)}` : `issued ${fmtDate(inv.issuedAt)}`}</td>
                      <td className="px-3 py-3 text-right"><span className="text-xs font-medium capitalize" style={{ color: inv.status === "paid" ? "#7CFF6B" : "#f59e0b" }}>{inv.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Communication log */}
          <div className="card p-6">
            <h3 className="mb-3 text-sm font-semibold">Communication log</h3>
            {notifications.length === 0 && <p className="text-sm text-[var(--color-muted)]">No emails sent yet.</p>}
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">✉ {NOTIF_LABEL[n.type as keyof typeof NOTIF_LABEL] ?? n.type}</span>
                    <span className="text-xs text-[var(--color-muted)]">{fmtDate(n.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-muted)]">{n.subject}</div>
                </div>
              ))}
            </div>
          </div>

          <ContractsPanel
            enrollmentId={m.id}
            contracts={m.contracts.map((c) => ({
              id: c.id, title: c.title, status: c.status,
              startDate: c.startDate ? new Date(c.startDate).toISOString() : null,
              endDate: c.endDate ? new Date(c.endDate).toISOString() : null,
              value: c.value, currency: c.currency, notes: c.notes,
            }))}
          />

          <NotesEditor enrollmentId={m.id} notes={m.notes ?? ""} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <ManagePanel
            enrollmentId={m.id}
            status={m.status}
            groupId={m.groupId}
            coachId={m.coachId}
            packageId={m.packageId}
            groups={opts.groups}
            coaches={opts.coaches}
            packages={opts.packages}
          />


          {publicProfilesEnabled && <PublicProfilePanel
            initial={{
              athleteId: a.id,
              publicProfileEnabled: a.publicProfileEnabled,
              publicSlug: a.publicSlug,
              publicVisibility: a.publicVisibility,
              publicBio: a.publicBio,
              publicPhotoUrl: a.publicPhotoUrl,
              publicShowAcademy: a.publicShowAcademy,
              publicShowRanking: a.publicShowRanking,
              publicShowResults: a.publicShowResults,
              publicShowMedia: a.publicShowMedia,
              publicShowExternalProfiles: a.publicShowExternalProfiles,
              publicContactEnabled: a.publicContactEnabled,
              publicVerified: a.publicVerified,
              fisCode: a.fisCode,
              fisProfileUrl: a.fisProfileUrl,
              atpPlayerId: a.atpPlayerId,
              atpProfileUrl: a.atpProfileUrl,
            }}
          />}

          <Panel title="Identity">
            <Row label="Email" value={a.email ?? "—"} />
            <Row label="Phone" value={a.phone ?? "—"} />
            <Row label="Nationality" value={COUNTRY[a.nationality]?.name ?? a.nationality} />
            <Row label="Date of birth" value={fmtDate(a.dob)} />
            <Row label="Emergency" value={a.emergencyContact ?? "—"} />
            {a.guardianName && <Row label="Guardian" value={`${a.guardianName}`} />}
            {a.guardianContact && <Row label="Guardian contact" value={a.guardianContact} />}
          </Panel>

          <Panel title="Activity">
            <div className="space-y-3">
              {m.events.map((e) => (
                <div key={e.id} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" />
                  <div className="flex-1 text-sm">
                    <div className="capitalize">{e.detail ?? `${e.type}${e.to ? ` → ${e.to}` : ""}`}</div>
                    <div className="text-xs text-[var(--color-muted)]">{fmtDate(e.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <div className="card flex items-center justify-between p-6">
            <div>
              <div className="text-sm font-semibold">Remove from academy</div>
              <div className="text-xs text-[var(--color-muted)]">Deletes the enrollment, payments and documents.</div>
            </div>
            <DeleteButton kind="enrollment" id={m.id} label="Remove" />
          </div>
        </div>
      </div>
    </>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-2 p-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="num mt-0.5 text-lg font-bold">{value}</div>
      {sub && <div className="text-[10px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <dl className="space-y-2 text-sm">{children}</dl>
    </div>
  );
}

function Row({ label, value, cap }: { label: string; value: string; cap?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className={`text-right ${cap ? "capitalize" : ""}`}>{value}</dd>
    </div>
  );
}

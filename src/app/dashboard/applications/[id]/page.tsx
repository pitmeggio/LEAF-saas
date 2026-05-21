import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, TrendArrow, Verified, ScorePill } from "@/components/ui";
import { GrowthChart, type Point } from "@/components/GrowthChart";
import { StatusSelector, AddNoteForm } from "@/components/ApplicationControls";
import { Modal, ApplicationEditForm, AcceptForm, DeleteButton } from "@/components/EntityForms";
import { getApplication } from "@/lib/queries";
import { getAssignmentOptions, getNotifications } from "@/lib/ops";
import { NOTIF_LABEL } from "@/lib/notifications";
import { DISCIPLINE_LABEL, COUNTRY, STATUS_LABEL, age, fmtDate, relativeDate, fmtPoints, type Status } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await getApplication(id);
  if (!app) notFound();
  const [opts, notifications] = await Promise.all([getAssignmentOptions(), getNotifications({ applicationId: id })]);

  const a = app.athlete;
  const chart: Point[] = a.rankings.map((r) => ({
    label: new Date(r.date).toLocaleDateString("en-GB", { month: "short" }),
    fisPoints: r.fisPoints,
  }));

  return (
    <>
      <PageHeader
        title="Application"
        subtitle={`${app.program?.name ?? "General"} · submitted ${relativeDate(app.submittedAt)}`}
        right={
          <div className="flex items-center gap-2">
            {app.conversation && <Link href={`/dashboard/inbox/${app.conversation.id}`} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface)]">✉ Conversation</Link>}
            <Modal label="Edit" title="Edit application" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-surface)]">
              <ApplicationEditForm application={{ id: app.id, programId: app.programId, packageId: app.packageId, score: app.score, message: app.message }} programs={opts.programs} packages={opts.packages} />
            </Modal>
            <DeleteButton kind="application" id={app.id} label="Delete" />
            <Link href="/dashboard/applications" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">← Back</Link>
          </div>
        }
      />

      <div className="grid gap-6 p-8 lg:grid-cols-3">
        {/* Left: athlete */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <Avatar first={a.firstName} last={a.lastName} color={a.photoColor} size={64} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/athletes/${a.id}`} className="text-xl font-bold hover:underline">
                    {a.firstName} {a.lastName}
                  </Link>
                  {a.verified && <Verified />}
                </div>
                <div className="mt-0.5 text-sm text-[var(--color-muted)]">
                  {COUNTRY[a.nationality]?.flag} {COUNTRY[a.nationality]?.name} · {age(a.dob)}y ·{" "}
                  {DISCIPLINE_LABEL[a.discipline]}
                </div>
              </div>
              <div className="flex items-center gap-5 text-right">
                <div>
                  <div className="num text-2xl font-bold">{fmtPoints(a.fisPoints)}</div>
                  <div className="text-xs text-[var(--color-muted)]">FIS pts</div>
                </div>
                <div>
                  <TrendArrow trend={app.trend} />
                  <div className="text-xs text-[var(--color-muted)]">12mo</div>
                </div>
                {app.score != null && (
                  <div>
                    <ScorePill score={app.score} />
                    <div className="text-xs text-[var(--color-muted)]">fit score</div>
                  </div>
                )}
              </div>
            </div>

            {app.message && (
              <div className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-fg)]/90">
                <div className="mb-1 text-xs uppercase tracking-wide text-[var(--color-muted)]">Motivation</div>
                {app.message}
              </div>
            )}

            {(app.currentRanking || app.previousClub || app.mediaLink || app.guardianName || app.guardianContact) && (
              <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {app.currentRanking && (
                  <Info label="Stated ranking / points" value={app.currentRanking} />
                )}
                {app.previousClub && <Info label="Previous academy / club" value={app.previousClub} />}
                {(app.guardianName || app.guardianContact) && (
                  <Info
                    label="Parent / guardian"
                    value={[app.guardianName, app.guardianContact].filter(Boolean).join(" · ")}
                  />
                )}
                {a.email && <Info label="Email" value={a.email} />}
                {app.mediaLink && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Video / documents</dt>
                    <dd className="mt-0.5 text-sm">
                      <a href={app.mediaLink} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline break-all">
                        {app.mediaLink}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          <div className="card p-6">
            <h3 className="mb-4 text-sm font-semibold">Growth trend</h3>
            {chart.length > 1 ? (
              <GrowthChart data={chart} />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-center text-sm text-[var(--color-muted)]">
                No FIS history yet.
                <span className="text-xs">Import a FIS code to build the trend automatically.</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-semibold">Notes</h3>
            <AddNoteForm applicationId={app.id} />
            <div className="mt-5 space-y-3">
              {app.notes.length === 0 && <p className="text-sm text-[var(--color-muted)]">No notes yet.</p>}
              {app.notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-muted)]">
                    <span className="font-medium text-[var(--color-fg)]">{n.author?.name ?? "Staff"}</span>
                    <span>{relativeDate(n.createdAt)}</span>
                  </div>
                  <p className="text-sm">{n.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: status + timeline */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="mb-3 text-sm font-semibold">Status</h3>
            <StatusSelector applicationId={app.id} current={app.status as Status} />
            {app.status !== "accepted" && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                <Modal label="✓ Accept & enroll" title="Confirm application acceptance" className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
                  <AcceptForm
                    application={{ id: app.id, packageId: app.packageId }}
                    athleteName={`${a.firstName} ${a.lastName}`}
                    academyName={app.academy.name}
                    packages={opts.packages}
                    groups={opts.groups}
                    coaches={opts.coaches}
                  />
                </Modal>
                <p className="mt-2 text-xs text-[var(--color-muted)]">Review package, group, coach and schedule before creating the enrollment.</p>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="mb-3 text-sm font-semibold">Details</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Preferred package" value={app.package?.name ?? "—"} />
              <Row label="Program" value={app.program?.name ?? "—"} />
              <Row label="Sport" value={app.sport === "tennis" ? "Tennis" : "Alpine skiing"} />
              <Row label="Source" value={app.source === "marketplace" ? "★ Marketplace" : "Public form"} />
              <Row label="Submitted" value={fmtDate(app.submittedAt)} />
              <Row label="World rank" value={a.worldRank != null ? String(a.worldRank) : "—"} mono />
            </dl>
          </div>

          <div className="card p-6">
            <h3 className="mb-3 text-sm font-semibold">Communication log</h3>
            {notifications.length === 0 && <p className="text-sm text-[var(--color-muted)]">No emails sent yet.</p>}
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">✉ {NOTIF_LABEL[n.type as keyof typeof NOTIF_LABEL] ?? n.type}</span>
                    <span className="text-xs text-[var(--color-muted)]">{relativeDate(n.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-muted)]">{n.subject}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-4 text-sm font-semibold">Status history</h3>
            <div className="space-y-3">
              {app.events.map((e) => (
                <div key={e.id} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" />
                  <div className="flex-1 text-sm">
                    <div>
                      {e.from ? `${STATUS_LABEL[e.from as Status]} → ` : "Created · "}
                      <span className="font-medium">{STATUS_LABEL[e.to as Status]}</span>
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">{fmtDate(e.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className={mono ? "num" : undefined}>{value}</dd>
    </div>
  );
}

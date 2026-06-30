import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { requireAcademyId } from "@/lib/auth";
import { getAcademyDossierHub } from "@/lib/tennis/dossier";
import { CATEGORY_META, type DossierCategory } from "@/lib/tennis/dossierTypes";
import { AddTennisAthleteButton } from "@/components/AddTennisAthleteButton";
import {
  ClipboardCheck, Trophy, Dumbbell, HeartPulse, Video, Search, File as FileIcon,
  Users, ArrowRight, Download, ExternalLink, type LucideIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

const ICON: Record<DossierCategory, LucideIcon> = {
  evaluation: ClipboardCheck, match_report: Trophy, physical: Dumbbell,
  medical: HeartPulse, video: Video, scouting: Search, file: FileIcon,
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", timeZone: "UTC" });

// Dossier Hub — the single place the staff lands. What got added across the
// whole roster, and every athlete's dossier one click away.
export default async function DossierHubPage() {
  const academyId = await requireAcademyId();
  const hub = await getAcademyDossierHub(academyId);

  return (
    <>
      <PageHeader
        title="Dossier"
        subtitle={`${hub.totalFiles} file · ${hub.athletes.length} ${hub.athletes.length === 1 ? "atleta" : "atleti"} · ${hub.staff.length} ${hub.staff.length === 1 ? "membro" : "membri"} staff`}
        right={<AddTennisAthleteButton />}
      />
      <div className="grid gap-6 p-8 lg:grid-cols-12">
        {/* Recent staff activity */}
        <section className="lg:col-span-7">
          <div className="kicker mb-3">Attività recente dello staff</div>
          {hub.recent.length === 0 ? (
            <div className="card p-8 text-center text-sm text-[var(--color-muted)]">
              Ancora nessun file. Apri un atleta e carica la prima scheda valutativa, un referto o un video — comparirà qui per tutto lo staff.
            </div>
          ) : (
            <ul className="space-y-2">
              {hub.recent.map((a) => {
                const meta = CATEGORY_META[a.category];
                const Icon = ICON[a.category];
                return (
                  <li key={a.id} className="card flex items-center gap-3 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${meta.color}22`, color: meta.color }}>
                      <Icon style={{ height: 18, width: 18 }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{a.title}</span>
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.label}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                        <Link href={`/dashboard/canvas/${a.athleteId}`} className="font-medium text-[var(--color-fg)]/80 hover:text-[var(--color-accent)]">{a.athleteName}</Link>
                        {" · "}{a.authorRole ? `${a.authorRole} · ` : ""}{a.authorName} · {fmtDate(a.createdAt)}
                      </div>
                    </div>
                    {a.hasBinary ? (
                      <a href={`/api/athlete-files/${a.id}/file`} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]" title="Apri file"><Download className="h-4 w-4" /></a>
                    ) : a.fileUrl ? (
                      <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:text-[var(--color-fg)]" title="Apri link"><ExternalLink className="h-4 w-4" /></a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Roster — every athlete's dossier */}
        <section className="lg:col-span-5">
          <div className="kicker mb-3">Dossier per atleta</div>
          {hub.athletes.length === 0 ? (
            <div className="card p-8 text-center text-sm text-[var(--color-muted)]">Nessun atleta ancora.</div>
          ) : (
            <div className="space-y-2">
              {hub.athletes.map((a) => (
                <Link key={a.athleteId} href={`/dashboard/canvas/${a.athleteId}`}
                  className="card group flex items-center justify-between p-3 transition-colors hover:border-[var(--color-accent)]">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{a.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                      <span>{a.fileCount} {a.fileCount === 1 ? "file" : "file"}</span>
                      {a.contributors > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{a.contributors}</span>}
                      {a.lastActivity && <span>· {fmtDate(a.lastActivity)}</span>}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

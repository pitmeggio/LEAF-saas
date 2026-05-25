import { prisma } from "@/lib/db";
import { CoachNoteComposer } from "@/components/CoachNoteComposer";
import { DeleteCoachNoteButton } from "@/components/CoachNoteControls";
import type { CoachNoteStructure } from "@/lib/ai/coachNotes";
import type { AthleteAiProfile } from "@/lib/ai/coachProfile";

// Coach Intelligence — wraps the composer, the structured-notes list and the
// living AI profile. Server component: reads the latest notes + profile from
// Prisma so the page revalidate cascade keeps it fresh after every action.

export async function CoachIntelligencePanel({
  athleteId,
  academyId,
  sport,
  canDeleteAuthorId,
  isAdmin,
}: {
  athleteId: string;
  academyId: string;
  sport: string;
  canDeleteAuthorId: string | null; // current user id, for "delete own note"
  isAdmin: boolean;
}) {
  const [athlete, notes] = await Promise.all([
    prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { aiProfile: true, aiProfileUpdatedAt: true },
    }),
    prisma.coachNote.findMany({
      where: { academyId, athleteId },
      include: {
        attachments: true,
        coach: { select: { name: true } },
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const profile = (athlete?.aiProfile as unknown as AthleteAiProfile | null) ?? null;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold">Coach intelligence</h3>
          <p className="text-xs text-[var(--color-muted)]">Adaptive notes — coach writes naturally, AI structures dynamically.</p>
        </div>
        <span className="text-[10px] text-[var(--color-muted)]">{notes.length} note{notes.length === 1 ? "" : "s"} on file</span>
      </div>

      <CoachNoteComposer athleteId={athleteId} sport={sport} />

      {profile && profile.noteCount > 0 && <AthleteAiProfileCard profile={profile} />}

      {notes.length === 0 ? (
        <div className="card p-5 text-sm text-[var(--color-muted)]">
          No coach notes yet. Add one above to start building this athlete&apos;s living profile.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <CoachNoteCard
              key={n.id}
              note={{
                id: n.id,
                createdAt: n.createdAt.toISOString(),
                rawText: n.rawText,
                kind: n.kind,
                status: n.status,
                engine: n.engine,
                error: n.error,
                summary: (n.aiSummary as unknown as CoachNoteStructure | null) ?? null,
                attachments: n.attachments.map((a) => ({ id: a.id, filename: a.filename, url: a.url })),
                authorName: n.author?.name ?? n.coach?.name ?? "—",
                ownedByMe: !!canDeleteAuthorId && n.authorId === canDeleteAuthorId,
              }}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Living AI profile snapshot ─────────────────────────────────────────────
function AthleteAiProfileCard({ profile }: { profile: AthleteAiProfile }) {
  const themes = Object.entries(profile.themeFrequency).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const updatedAt = new Date(profile.lastUpdatedAt);
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "#0a0c10" }}>AI</span>
          <h4 className="text-sm font-semibold">Athlete profile · derived</h4>
        </div>
        <span className="text-[10px] text-[var(--color-muted)]">{profile.noteCount} note(s) · updated {updatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
      </div>

      {themes.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Coach lens (theme frequency)</div>
          <div className="flex flex-wrap gap-1.5">
            {themes.map(([theme, count]) => {
              const trend = profile.trends[theme];
              const tone = trend === "watch" ? "#f87171" : trend === "rising" ? "var(--color-accent)" : "var(--color-muted)";
              return (
                <span key={theme} className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px]">
                  <span className="capitalize">{theme}</span>
                  <span className="num text-[var(--color-muted)]">{count}</span>
                  {trend && <span className="text-[9px] uppercase tracking-wide" style={{ color: tone }}>· {trend}</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ProfileList title="Recurring strengths" items={profile.recurringStrengths} emptyText="None recorded yet." tone="accent" />
        <ProfileList title="Recurring weaknesses" items={profile.recurringWeaknesses} emptyText="None recorded yet." tone="warn" />
        <ProfileList title="Priorities · next focus" items={profile.priorities} emptyText="No active priorities." tone="muted" />
        <ProfileList title="Injury flags" items={profile.injuryFlags} emptyText="No injury cues." tone="danger" />
      </div>
    </div>
  );
}

function ProfileList({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: { text: string; count: number; lastSeen: string }[];
  emptyText: string;
  tone: "accent" | "warn" | "muted" | "danger";
}) {
  const color = tone === "accent" ? "var(--color-accent)" : tone === "warn" ? "#f59e0b" : tone === "danger" ? "#f87171" : "var(--color-muted)";
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">{emptyText}</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {items.slice(0, 4).map((it, i) => (
            <li key={i} className="flex items-start justify-between gap-2">
              <span className="flex-1">{it.text}</span>
              <span className="num shrink-0 text-[10px]" style={{ color }}>×{it.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Single note card ───────────────────────────────────────────────────────
type NoteCardProps = {
  note: {
    id: string;
    createdAt: string;
    rawText: string;
    kind: string | null;
    status: string;
    engine: string | null;
    error: string | null;
    summary: CoachNoteStructure | null;
    attachments: { id: string; filename: string; url: string }[];
    authorName: string;
    ownedByMe: boolean;
  };
  isAdmin: boolean;
};

function CoachNoteCard({ note, isAdmin }: NoteCardProps) {
  const date = new Date(note.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = new Date(note.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const isStructured = note.status === "structured" && note.summary;
  return (
    <article className="card p-5">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{note.authorName}</span>
          <span className="text-[11px] text-[var(--color-muted)]">{date} · {time}</span>
          {note.kind && <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{note.kind.replace(/_/g, " ")}</span>}
        </div>
        <div className="flex items-center gap-2">
          {note.engine && (
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
              {note.engine === "llm" ? "AI · LLM" : "AI · local"}
            </span>
          )}
          {note.summary && typeof note.summary.confidence === "number" && (
            <span className="text-[10px] text-[var(--color-muted)]">conf. {Math.round(note.summary.confidence * 100)}%</span>
          )}
          {(isAdmin || note.ownedByMe) && <DeleteCoachNoteButton id={note.id} />}
        </div>
      </header>

      {/* Raw note — always shown verbatim under the structured summary, so the
          coach can re-read what they wrote at any time. */}
      {isStructured && note.summary ? (
        <>
          <StructuredSummary summary={note.summary} />
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-fg)]">Coach&apos;s own words</summary>
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-[var(--color-surface-2)] p-3 text-[13px] leading-relaxed text-[var(--color-muted)]">{note.rawText}</p>
          </details>
        </>
      ) : (
        <>
          {note.status === "failed" && (
            <div className="mb-2 rounded-md bg-[#f8717118] p-2 text-xs text-[#f87171]">AI structuring failed{note.error ? ` · ${note.error}` : ""}. Your note is saved verbatim below.</div>
          )}
          {note.status === "pending" && (
            <div className="mb-2 text-xs text-[var(--color-muted)]">AI structuring queued.</div>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.rawText}</p>
        </>
      )}

      {note.attachments.length > 0 && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Attachments</div>
          <ul className="flex flex-wrap gap-2">
            {note.attachments.map((a) => (
              <li key={a.id}>
                <a href={a.url} target="_blank" rel="noopener" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs hover:border-[var(--color-accent)]">{a.filename} ↗</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function StructuredSummary({ summary }: { summary: CoachNoteStructure }) {
  return (
    <div className="space-y-3">
      {summary.themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.themes.map((t) => (
            <span key={t} className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{t}</span>
          ))}
        </div>
      )}
      {summary.sections.map((s, i) => (
        <div key={i}>
          <div className="mb-1 text-xs font-semibold">{s.title}</div>
          <ul className="space-y-1 pl-4 text-[13px] leading-relaxed text-[var(--color-fg)]/90">
            {s.bullets.map((b, j) => (
              <li key={j} className="list-disc">{b}</li>
            ))}
          </ul>
        </div>
      ))}
      <ChipRow title="Strengths" items={summary.strengths} tone="accent" />
      <ChipRow title="Weaknesses" items={summary.weaknesses} tone="warn" />
      <ChipRow title="Priorities · next focus" items={summary.priorities} tone="muted" />
      <ChipRow title="Injury flags" items={summary.injuryFlags} tone="danger" />
    </div>
  );
}

function ChipRow({ title, items, tone }: { title: string; items: string[]; tone: "accent" | "warn" | "muted" | "danger" }) {
  if (items.length === 0) return null;
  const color = tone === "accent" ? "var(--color-accent)" : tone === "warn" ? "#f59e0b" : tone === "danger" ? "#f87171" : "var(--color-muted)";
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{title}</div>
      <ul className="space-y-1 text-[13px] leading-relaxed">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2"><span style={{ color }}>•</span><span>{it}</span></li>
        ))}
      </ul>
    </div>
  );
}

// Tennis Athlete Profile — coach-driven, no federation dependency.
// Renders only when athlete.sport === "tennis". The same /members/[id]
// page keeps the FIS performance chart for ski athletes; this card swaps
// in for tennis. Empty state nudges the admin to fill in the basics.

export type TennisProfile = {
  dominantHand: string | null;
  playingStyle: string | null;
  technicalLevel: number | null;
  tacticalLevel: number | null;
  physicalLevel: number | null;
  mentalLevel: number | null;
  developmentGoals: string | null;
};

const HAND_LABEL: Record<string, string> = {
  right: "Right",
  left: "Left",
  ambidextrous: "Ambidextrous",
};

export function TennisProfileCard({ profile }: { profile: TennisProfile }) {
  const hasAny = Boolean(
    profile.dominantHand ||
      profile.playingStyle ||
      profile.technicalLevel ||
      profile.tacticalLevel ||
      profile.physicalLevel ||
      profile.mentalLevel ||
      profile.developmentGoals,
  );

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Tennis profile</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">Coach-curated · no federation feed required</p>
        </div>
        <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">tennis</span>
      </div>

      {!hasAny ? (
        <p className="text-sm text-[var(--color-muted)]">
          No tennis profile fields yet. Click <span className="font-medium text-[var(--color-fg)]">Edit</span> at the top of this page to add dominant hand, playing style and the four development levels.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <KV label="Dominant hand" value={profile.dominantHand ? HAND_LABEL[profile.dominantHand] ?? profile.dominantHand : "—"} />
            <KV label="Playing style" value={profile.playingStyle ?? "—"} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <LevelBar label="Technical" value={profile.technicalLevel} />
            <LevelBar label="Tactical" value={profile.tacticalLevel} />
            <LevelBar label="Physical" value={profile.physicalLevel} />
            <LevelBar label="Mental" value={profile.mentalLevel} />
          </div>

          {profile.developmentGoals && (
            <div className="mt-5 border-t border-[var(--color-border)] pt-4">
              <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">Development goals</div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-fg)]/90">{profile.developmentGoals}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function LevelBar({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const pct = Math.max(0, Math.min(100, (v / 10) * 100));
  const color = v === 0 ? "var(--color-muted)" : v >= 8 ? "var(--color-accent)" : v >= 5 ? "#7CFF6B" : "#f59e0b";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium">{label}</span>
        <span className="num text-xs" style={{ color }}>{value != null ? `${value}/10` : "—"}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

import Link from "next/link";
import type { RecruitingStatus, RecruitingBanner as Banner, RecruitingAcademyCard } from "@/lib/profiles";

// Apply CTA that routes to an external URL (new tab) or the internal apply form.
export function ApplyCTA({ href, external, className, style, children }: { href: string; external: boolean; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>{children}</a>;
  return <Link href={href} className={className} style={style}>{children}</Link>;
}

const STATUS_META: Record<RecruitingStatus, { label: string; color: string }> = {
  OPEN: { label: "Applications Open", color: "#7cff6b" },
  LIMITED_SPOTS: { label: "Limited Spots", color: "#f59e0b" },
  WAITLIST_OPEN: { label: "Waitlist Open", color: "#60a5fa" },
  CLOSED: { label: "Applications Closed", color: "#8a93a6" },
};

export function RecruitingBadge({ status, size = "md" }: { status: RecruitingStatus; size?: "sm" | "md" }) {
  const m = STATUS_META[status];
  const pad = size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad}`} style={{ background: `${m.color}1a`, color: m.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color, boxShadow: status !== "CLOSED" ? `0 0 8px ${m.color}` : undefined }} />
      {m.label}
    </span>
  );
}

// Premium recruiting banner shown on an athlete's public profile when their academy recruits.
export function AcademyRecruitingBanner({ banner }: { banner: Banner }) {
  const closed = banner.status === "CLOSED";
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: banner.logoColor }} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black" style={{ background: banner.logoColor, color: "#0a0c10" }}>
            {banner.academyName[0]}
          </div>
          <div>
            <RecruitingBadge status={banner.status} size="sm" />
            <div className="mt-1.5 text-sm font-semibold">
              {banner.headline ?? `${closed ? "Recruiting at" : "Applications open at"} ${banner.academyName}`}
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              {banner.academyName}{banner.season ? ` · ${banner.season} season` : ""}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/profiles/academy/${banner.academySlug}`} className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-xs font-medium hover:bg-[var(--color-surface-2)]">
            View academy
          </Link>
          {banner.applyEnabled && !closed && banner.applyHref && (
            <ApplyCTA href={banner.applyHref} external={banner.applyExternal} className="rounded-lg px-3.5 py-2 text-xs font-semibold text-[#0a0c10]" style={{ background: banner.logoColor }}>
              Apply now
            </ApplyCTA>
          )}
        </div>
      </div>
    </div>
  );
}

// Premium "Applications Open" card for the /profiles landing grid.
export function AcademyRecruitingCard({ a }: { a: RecruitingAcademyCard }) {
  const closed = a.status === "CLOSED";
  return (
    <div className="card relative flex flex-col overflow-hidden p-5">
      {a.featured && (
        <span className="absolute right-4 top-4 rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">Featured</span>
      )}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black" style={{ background: a.logoColor, color: "#0a0c10" }}>{a.name[0]}</div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{a.name}</div>
          <div className="truncate text-xs text-[var(--color-muted)]">{a.location ?? ""}{a.location ? " · " : ""}<span className="capitalize">{a.sport}</span></div>
        </div>
      </div>
      <div className="mt-3"><RecruitingBadge status={a.status} size="sm" /></div>
      <p className="mt-3 flex-1 text-sm text-[var(--color-muted)]">
        {a.headline ?? (a.season ? `Applications open for the ${a.season} season.` : "Applications open.")}
      </p>
      <div className="mt-4 flex gap-2">
        <Link href={`/profiles/academy/${a.slug}`} className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-center text-xs font-medium hover:bg-[var(--color-surface-2)]">View program</Link>
        {a.applyEnabled && !closed && a.applyHref && (
          <ApplyCTA href={a.applyHref} external={a.applyExternal} className="flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold text-[#0a0c10]" style={{ background: a.logoColor }}>
            Apply now
          </ApplyCTA>
        )}
      </div>
    </div>
  );
}

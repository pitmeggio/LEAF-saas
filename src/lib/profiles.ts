import { prisma } from "@/lib/db";
import { computePerformance, type PerformanceStats } from "@/lib/performance";

// ── Public profile read layer (the privacy boundary) ─────────────────────────
// This module is the ONLY sanctioned way to read athlete data for the public
// profiles.leaf.ai experience. It returns a hand-built DTO that contains
// exclusively public-safe fields, honouring each per-field opt-in flag. It NEVER
// selects or returns private columns (notes, injuryFlag/medical, email, phone,
// address, guardian/parent, documents, payments, conversations, evaluations).

export type PublicMediaItem = {
  id: string;
  type: string; // IMAGE | VIDEO | PDF | LINK
  title: string;
  url: string;
  thumbnailUrl: string | null;
};

export type PublicResult = {
  id: string;
  date: Date;
  eventName: string;
  location: string;
  discipline: string;
  rank: number;
  fisPoints: number;
};

export type RecruitingStatus = "OPEN" | "LIMITED_SPOTS" | "WAITLIST_OPEN" | "CLOSED";

// Compact recruiting banner shown on an athlete's profile when their academy recruits.
export type RecruitingBanner = {
  academySlug: string;
  academyName: string;
  logoColor: string;
  status: RecruitingStatus;
  headline: string | null;
  season: string | null;
  applyEnabled: boolean;
  applyHref: string | null;
  applyExternal: boolean;
};

// Premium "Applications Open" card for the /profiles landing.
export type RecruitingAcademyCard = {
  slug: string;
  name: string;
  logoColor: string;
  location: string | null;
  sport: string;
  season: string | null;
  status: RecruitingStatus;
  headline: string | null;
  featured: boolean;
  applyEnabled: boolean;
  applyHref: string | null;
  applyExternal: boolean;
};

// Full public academy recruiting page payload — public-safe fields only.
export type PublicRecruitingAcademy = {
  slug: string;
  name: string;
  logoColor: string;
  location: string | null;
  sport: string;
  season: string | null;
  bio: string | null;
  headline: string | null;
  description: string | null;
  status: RecruitingStatus;
  availableSpots: number | null;
  applicationDeadline: Date | null;
  acceptedCountries: string[];
  ageCategories: string[];
  programTypes: string[];
  rankingRequirement: string | null;
  disciplines: string[];
  coaches: { id: string; name: string; role: string; specialization: string | null }[];
  contactEmail: string | null;
  applyEnabled: boolean;
  applyHref: string | null;
  applyExternal: boolean;
  viewProgramHref: string;
};

export type PublicProfile = {
  slug: string;
  firstName: string;
  lastName: string;
  nationality: string;
  sport: string;
  primaryDiscipline: string;
  disciplines: string[];
  photoColor: string;
  publicPhotoUrl: string | null;
  publicBio: string | null;
  verified: boolean;
  // optional sections (present only when the corresponding flag is on)
  academyName: string | null;
  fisPoints: number | null;
  worldRank: number | null;
  results: PublicResult[] | null;
  media: PublicMediaItem[] | null;
  externalLinks: { fisProfileUrl: string | null; atpProfileUrl: string | null; fisCode: string | null } | null;
  contactEnabled: boolean;
  recruiting: RecruitingBanner | null; // present only when the athlete's academy is recruiting
  // Performance layer
  pointsEvolution: { label: string; fisPoints: number }[] | null; // free trend chart (gated by publicShowRanking)
  performance: PerformanceStats | null; // premium analytics source (gated by publicShowResults)
  premiumUnlocked: boolean; // academy-enrolled athletes get premium analytics free
  // Sport-specific record block — set for sports without federation data
  // (tennis today). Driven by the SportModule capabilities downstream.
  tennisRecord: { total: number; wins: number; losses: number; winRate: number } | null;
};

export type ResolveResult =
  | { status: "ok"; profile: PublicProfile }
  | { status: "not_found" }; // privacy denials collapse to not_found (renders 404)

const RECRUITING_STATUSES: RecruitingStatus[] = ["OPEN", "LIMITED_SPOTS", "WAITLIST_OPEN", "CLOSED"];
function normStatus(s: string | null | undefined): RecruitingStatus {
  return RECRUITING_STATUSES.includes(s as RecruitingStatus) ? (s as RecruitingStatus) : "CLOSED";
}
// Split a newline/comma-separated settings string into trimmed, non-empty values.
function splitList(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
}

// Resolve the Apply CTA target: an external applicationUrl (when set) takes priority
// over the internal /academy/[slug]/apply form, which is gated by publicApplyEnabled.
function applyTarget(opts: { slug: string; publicApplyEnabled: boolean; applicationUrl: string | null }) {
  if (opts.applicationUrl) return { applyEnabled: true, applyHref: opts.applicationUrl, applyExternal: true };
  if (opts.publicApplyEnabled) return { applyEnabled: true, applyHref: `/academy/${opts.slug}/apply`, applyExternal: false };
  return { applyEnabled: false, applyHref: null as string | null, applyExternal: false };
}

// Resolve a public profile for the given slug.
// viewerAcademyId: the academyId of the currently logged-in viewer (or null if anonymous).
// Used only to gate ACADEMY_ONLY profiles — everything else is anonymous-safe.
export async function resolvePublicProfile(slug: string, viewerAcademyId: string | null): Promise<ResolveResult> {
  const a = await prisma.athlete.findUnique({
    where: { publicSlug: slug },
    include: {
      results: { orderBy: { date: "desc" }, take: 60 },
      rankings: { orderBy: { date: "asc" }, select: { date: true, fisPoints: true } },
      publicMedia: { where: { isApprovedPublic: true }, orderBy: { sortOrder: "asc" } },
      // enrollments only to (a) derive academy name, (b) gate ACADEMY_ONLY,
      // (c) gate the platform-level featurePublicProfiles flag, and (d) build
      // the recruiting banner — we read only public-safe academy fields, never
      // any operational/financial enrollment data.
      enrollments: {
        select: {
          academyId: true,
          academy: {
            select: {
              name: true, slug: true, status: true, logoColor: true, season: true,
              featurePublicProfiles: true,
              recruitingEnabled: true, recruitingStatus: true, publicRecruitingHeadline: true,
              publicApplyEnabled: true, applicationUrl: true,
            },
          },
        },
      },
    },
  });

  // Hard privacy gates — every denial returns not_found so the page 404s.
  if (!a) return { status: "not_found" };
  if (!a.publicProfileEnabled) return { status: "not_found" };
  // Platform-level gate: public profiles only render when at least one of the
  // athlete's enrolled academies has the feature on. Keeps the page honest
  // about availability while the discovery / marketplace layer is in flight.
  const anyAcademyHasFeature = a.enrollments.some((e) => e.academy?.featurePublicProfiles);
  if (!anyAcademyHasFeature) return { status: "not_found" };

  const vis = a.publicVisibility;
  if (vis === "PRIVATE") return { status: "not_found" };
  // INVITE_ONLY: token structure not implemented yet → treat as not visible.
  if (vis === "INVITE_ONLY") return { status: "not_found" };

  const academyIds = a.enrollments.map((e) => e.academyId);
  if (vis === "ACADEMY_ONLY") {
    if (!viewerAcademyId || !academyIds.includes(viewerAcademyId)) return { status: "not_found" };
  }
  // vis === "PUBLIC" (and the allowed ACADEMY_ONLY case) fall through to render.

  // Primary academy = the most relevant active enrollment's academy (display only).
  const primaryAcademyRow =
    a.enrollments.find((e) => e.academy?.status === "active")?.academy ??
    a.enrollments[0]?.academy ??
    null;
  const primaryAcademy = primaryAcademyRow?.name ?? null;

  // Recruiting banner: only when the primary academy is active AND recruiting.
  let recruiting: RecruitingBanner | null = null;
  if (primaryAcademyRow && primaryAcademyRow.status === "active" && primaryAcademyRow.recruitingEnabled) {
    const t = applyTarget({ slug: primaryAcademyRow.slug, publicApplyEnabled: primaryAcademyRow.publicApplyEnabled, applicationUrl: primaryAcademyRow.applicationUrl });
    recruiting = {
      academySlug: primaryAcademyRow.slug,
      academyName: primaryAcademyRow.name,
      logoColor: primaryAcademyRow.logoColor,
      status: normStatus(primaryAcademyRow.recruitingStatus),
      headline: primaryAcademyRow.publicRecruitingHeadline,
      season: primaryAcademyRow.season,
      ...t,
    };
  }

  const distinctDisciplines = Array.from(
    new Set([a.discipline, ...a.results.map((r) => r.discipline)].filter(Boolean)),
  );

  // Performance analytics (computed from all results + ranking history).
  const perf = computePerformance(
    a.results.map((r) => ({ date: r.date, discipline: r.discipline, rank: r.rank, fisPoints: r.fisPoints, status: r.status })),
    a.rankings.map((r) => ({ date: r.date, fisPoints: r.fisPoints })),
  );
  // Premium is unlocked free for athletes enrolled in a Leaf academy.
  const premiumUnlocked = a.enrollments.length > 0;

  // Tennis match record — only queried for tennis athletes whose results are
  // public. Privacy: gated by publicShowResults (same flag as race results).
  // Aggregated across every academy the athlete is enrolled with.
  let tennisRecord: PublicProfile["tennisRecord"] = null;
  if (a.sport === "tennis" && a.publicShowResults && academyIds.length > 0) {
    const matches = await prisma.tennisMatch.findMany({
      where: { athleteId: a.id, academyId: { in: academyIds } },
      select: { result: true },
    });
    const total = matches.length;
    const wins = matches.filter((m) => m.result === "won").length;
    if (total > 0) {
      tennisRecord = { total, wins, losses: total - wins, winRate: Math.round((wins / total) * 100) };
    }
  }

  const profile: PublicProfile = {
    slug,
    firstName: a.firstName,
    lastName: a.lastName,
    nationality: a.nationality,
    sport: a.sport,
    primaryDiscipline: a.discipline,
    disciplines: distinctDisciplines,
    photoColor: a.photoColor,
    publicPhotoUrl: a.publicPhotoUrl,
    publicBio: a.publicBio,
    verified: a.publicVerified,
    academyName: a.publicShowAcademy ? primaryAcademy : null,
    fisPoints: a.publicShowRanking ? a.fisPoints : null,
    worldRank: a.publicShowRanking ? a.worldRank : null,
    results: a.publicShowResults
      ? a.results.slice(0, 6).map((r) => ({
          id: r.id,
          date: r.date,
          eventName: r.eventName,
          location: r.location,
          discipline: r.discipline,
          rank: r.rank,
          fisPoints: r.fisPoints,
        }))
      : null,
    media: a.publicShowMedia
      ? a.publicMedia.map((m) => ({ id: m.id, type: m.type, title: m.title, url: m.url, thumbnailUrl: m.thumbnailUrl }))
      : null,
    externalLinks: a.publicShowExternalProfiles
      ? { fisProfileUrl: a.fisProfileUrl, atpProfileUrl: a.atpProfileUrl, fisCode: a.fisCode }
      : null,
    contactEnabled: a.publicContactEnabled,
    recruiting,
    pointsEvolution: a.publicShowRanking && perf.pointsEvolution.length >= 2 ? perf.pointsEvolution : null,
    performance: a.publicShowResults ? perf : null,
    premiumUnlocked,
    tennisRecord,
  };

  return { status: "ok", profile };
}

// Public academy recruiting page payload. Public-safe ONLY — never returns coach
// cost/email, finance, or any operational data. Gated by recruitingEnabled + active.
export async function getPublicRecruitingAcademy(slug: string): Promise<PublicRecruitingAcademy | null> {
  const a = await prisma.academy.findUnique({
    where: { slug },
    include: {
      programs: { select: { discipline: true } },
      coaches: {
        where: { active: true },
        select: { id: true, name: true, role: true, specialization: true },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!a) return null;
  if (a.status !== "active") return null;
  if (!a.recruitingEnabled) return null;

  const disciplines = Array.from(new Set(a.programs.map((p) => p.discipline).filter(Boolean)));

  return {
    slug: a.slug,
    name: a.name,
    logoColor: a.logoColor,
    location: a.location,
    sport: a.sport,
    season: a.season,
    bio: a.description,
    headline: a.publicRecruitingHeadline,
    description: a.publicRecruitingDescription,
    status: normStatus(a.recruitingStatus),
    availableSpots: a.availableSpots,
    applicationDeadline: a.applicationDeadline,
    acceptedCountries: splitList(a.acceptedCountries),
    ageCategories: splitList(a.ageCategories),
    programTypes: splitList(a.programTypes),
    rankingRequirement: a.rankingRequirement,
    disciplines,
    coaches: a.coaches.map((c) => ({ id: c.id, name: c.name, role: c.role, specialization: c.specialization })),
    contactEmail: a.contactEmail,
    ...applyTarget({ slug: a.slug, publicApplyEnabled: a.publicApplyEnabled, applicationUrl: a.applicationUrl }),
    viewProgramHref: `/academy/${a.slug}`,
  };
}

// Public-safe list of academies actively recruiting — powers the /profiles landing
// "Applications Open" cards. Excludes CLOSED (not accepting). Featured first.
export async function getRecruitingAcademies(): Promise<RecruitingAcademyCard[]> {
  const rows = await prisma.academy.findMany({
    where: { status: "active", recruitingEnabled: true, recruitingStatus: { not: "CLOSED" } },
    select: {
      slug: true, name: true, logoColor: true, location: true, sport: true, season: true,
      recruitingStatus: true, publicRecruitingHeadline: true, featuredAcademy: true,
      publicApplyEnabled: true, applicationUrl: true,
    },
    orderBy: [{ featuredAcademy: "desc" }, { name: "asc" }],
  });
  return rows.map((a) => ({
    slug: a.slug,
    name: a.name,
    logoColor: a.logoColor,
    location: a.location,
    sport: a.sport,
    season: a.season,
    status: normStatus(a.recruitingStatus),
    headline: a.publicRecruitingHeadline,
    featured: a.featuredAcademy,
    ...applyTarget({ slug: a.slug, publicApplyEnabled: a.publicApplyEnabled, applicationUrl: a.applicationUrl }),
  }));
}

export type PublicOpportunity = {
  id: string;
  title: string;
  type: string;
  season: string | null;
  ageGroup: string | null;
  discipline: string | null;
  packageType: string | null;
  price: number | null; // null when the academy chose not to show price publicly
  currency: string;
  applicationDeadline: Date | null;
  spotsAvailable: number | null;
  description: string | null;
};

// Published opportunities for an active academy (public-safe). Price hidden unless
// the academy opted to show it. Returns [] if the academy is missing/inactive.
export async function getPublicOpportunities(academySlug: string): Promise<PublicOpportunity[]> {
  const academy = await prisma.academy.findUnique({ where: { slug: academySlug }, select: { id: true, status: true } });
  if (!academy || academy.status !== "active") return [];
  const rows = await prisma.opportunity.findMany({
    where: { academyId: academy.id, status: "published" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((o) => ({
    id: o.id,
    title: o.title,
    type: o.type,
    season: o.season,
    ageGroup: o.ageGroup,
    discipline: o.discipline,
    packageType: o.packageType,
    price: o.pricePublic ? o.price : null,
    currency: o.currency,
    applicationDeadline: o.applicationDeadline,
    spotsAvailable: o.spotsAvailable,
    description: o.description,
  }));
}

export type AcademyAthleteCard = {
  slug: string;
  firstName: string;
  lastName: string;
  nationality: string;
  sport: string;
  discipline: string;
  photoColor: string;
  publicPhotoUrl: string | null;
  verified: boolean;
  fisPoints: number | null;
};

export type AcademyProfilesPage = {
  academy: { name: string; slug: string; logoColor: string; location: string | null };
  athletes: AcademyAthleteCard[];
};

// Public-safe list of an academy's PUBLIC athletes — powers /academy/[slug]/profiles.
// Only PUBLIC + enabled athletes enrolled at the academy are shown (no ACADEMY_ONLY /
// PRIVATE), and only public-safe fields. Returns null if the academy is missing/inactive.
export async function getAcademyPublicAthletes(slug: string): Promise<AcademyProfilesPage | null> {
  const academy = await prisma.academy.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, logoColor: true, location: true, status: true, featurePublicProfiles: true },
  });
  if (!academy || academy.status !== "active") return null;
  // Platform-level gate — same as resolvePublicProfile. Academy must have the
  // featurePublicProfiles flag on to expose any athlete roster publicly.
  if (!academy.featurePublicProfiles) return null;

  const rows = await prisma.athlete.findMany({
    where: {
      publicProfileEnabled: true,
      publicVisibility: "PUBLIC",
      publicSlug: { not: null },
      enrollments: { some: { academyId: academy.id } },
    },
    select: {
      publicSlug: true, firstName: true, lastName: true, nationality: true, sport: true,
      discipline: true, photoColor: true, publicPhotoUrl: true, publicVerified: true,
      fisPoints: true, publicShowRanking: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return {
    academy: { name: academy.name, slug: academy.slug, logoColor: academy.logoColor, location: academy.location },
    athletes: rows.map((a) => ({
      slug: a.publicSlug as string,
      firstName: a.firstName,
      lastName: a.lastName,
      nationality: a.nationality,
      sport: a.sport,
      discipline: a.discipline,
      photoColor: a.photoColor,
      publicPhotoUrl: a.publicPhotoUrl,
      verified: a.publicVerified,
      fisPoints: a.publicShowRanking ? a.fisPoints : null,
    })),
  };
}

// ── Public directory (the unified Explore hub) ───────────────────────────────
export type AcademyDirectoryCard = {
  slug: string;
  name: string;
  logoColor: string;
  location: string | null;
  sport: string;
  season: string | null;
  recruiting: RecruitingStatus | null; // null when not recruiting
  athleteCount: number;
};

// NOTE: There is intentionally NO public athlete directory. LEAF does not expose a
// browsable roster of athletes — a profile is reachable only via its owner-shared link
// (resolvePublicProfile by slug). This is a deliberate privacy boundary, not an omission.

// All active academies (public-safe), with a count of their PUBLIC athletes.
export async function getPublicAcademiesDirectory(): Promise<AcademyDirectoryCard[]> {
  const rows = await prisma.academy.findMany({
    where: { status: "active" },
    select: {
      slug: true, name: true, logoColor: true, location: true, sport: true, season: true,
      recruitingEnabled: true, recruitingStatus: true,
      enrollments: {
        where: { athlete: { publicProfileEnabled: true, publicVisibility: "PUBLIC" } },
        select: { athleteId: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((a) => ({
    slug: a.slug,
    name: a.name,
    logoColor: a.logoColor,
    location: a.location,
    sport: a.sport,
    season: a.season,
    recruiting: a.recruitingEnabled ? normStatus(a.recruitingStatus) : null,
    athleteCount: new Set(a.enrollments.map((e) => e.athleteId)).size,
  }));
}

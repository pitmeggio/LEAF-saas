import { z } from "zod";
import { STATUSES, ENROLLMENT_STATUSES } from "@/lib/domain";

// Reusable optional-string helpers (treat "" as undefined).
const optionalStr = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^https?:\/\/.+/.test(v), { message: "Enter a valid URL (http/https)." });

export const fisCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{3,12}$/, "Enter a valid FIS code (3–12 letters/digits).");

// Pipeline status changes
export const statusSchema = z.enum(STATUSES);

export const moveApplicationSchema = z.object({
  applicationId: z.string().min(1),
  to: statusSchema,
});

// Coach notes
export const addNoteSchema = z.object({
  applicationId: z.string().min(1),
  body: z.string().trim().min(1, "Note cannot be empty.").max(2000),
});

// FIS import (dashboard form + public form share this code rule)
export const fisImportSchema = z.object({
  fisCode: fisCodeSchema,
});

// ── Public athlete profile (recruiting portfolio) ────────────────────────────
const publicSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug is too short.")
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.");

export const publicProfileSchema = z
  .object({
    athleteId: z.string().min(1),
    publicProfileEnabled: z.boolean(),
    publicSlug: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.toLowerCase() : undefined))
      .refine((v) => v === undefined || publicSlugSchema.safeParse(v).success, {
        message: "Use lowercase letters, numbers and hyphens only (min 3 chars).",
      }),
    publicVisibility: z.enum(["PUBLIC", "PRIVATE", "INVITE_ONLY", "ACADEMY_ONLY"]),
    publicBio: optionalStr(1500),
    publicPhotoUrl: optionalUrl,
    publicShowAcademy: z.boolean(),
    publicShowRanking: z.boolean(),
    publicShowResults: z.boolean(),
    publicShowMedia: z.boolean(),
    publicShowExternalProfiles: z.boolean(),
    publicContactEnabled: z.boolean(),
    publicVerified: z.boolean(),
    fisCode: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || /^[A-Za-z0-9-]{3,12}$/.test(v), { message: "Enter a valid FIS code (3–12 letters/digits)." }),
    fisProfileUrl: optionalUrl,
    atpPlayerId: optionalStr(40),
    atpProfileUrl: optionalUrl,
  })
  // A live (non-private) profile must have a slug to be reachable.
  .refine((d) => !(d.publicProfileEnabled && d.publicVisibility !== "PRIVATE") || !!d.publicSlug, {
    message: "A public slug is required to enable the profile.",
    path: ["publicSlug"],
  });
export type PublicProfileInput = z.infer<typeof publicProfileSchema>;

// ── Opportunities (publishable recruiting openings) ──────────────────────────
export const OPPORTUNITY_TYPES = ["program", "position", "camp", "package"] as const;
export const opportunityStatusSchema = z.enum(["draft", "published", "closed"]);

export const opportunityInputSchema = z.object({
  title: z.string().trim().min(2, "Title is required.").max(120),
  type: z.enum(OPPORTUNITY_TYPES).default("program"),
  season: optionalStr(20),
  ageGroup: optionalStr(40),
  discipline: optionalStr(40),
  packageType: optionalStr(60),
  price: z.number().int().min(0).max(10_000_000).nullable().optional(),
  currency: z.string().trim().max(8).optional().transform((v) => (v ? v : "EUR")),
  pricePublic: z.boolean(),
  applicationDeadline: optionalStr(20), // YYYY-MM-DD → Date in the action
  spotsAvailable: z.number().int().min(0).max(100000).nullable().optional(),
  description: optionalStr(2000),
  status: opportunityStatusSchema.default("draft"),
});
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;

// ── Academy recruiting settings ──────────────────────────────────────────────
export const recruitingStatusSchema = z.enum(["OPEN", "LIMITED_SPOTS", "WAITLIST_OPEN", "CLOSED"]);
export const PROGRAM_TYPES = ["Full Package", "Training Only", "Race Support", "Custom"] as const;

export const recruitingSettingsSchema = z.object({
  recruitingEnabled: z.boolean(),
  recruitingStatus: recruitingStatusSchema,
  publicRecruitingHeadline: optionalStr(160),
  publicRecruitingDescription: optionalStr(2000),
  season: optionalStr(20),
  applicationDeadline: optionalStr(20), // "YYYY-MM-DD" — converted to Date in the action
  availableSpots: z.number().int().min(0).max(100000).nullable().optional(),
  acceptedCountries: optionalStr(500),
  ageCategories: optionalStr(300),
  rankingRequirement: optionalStr(300),
  programTypes: z.array(z.enum(PROGRAM_TYPES)).max(4).optional().default([]),
  applicationUrl: optionalUrl,
  featuredAcademy: z.boolean(),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), { message: "Enter a valid contact email." }),
  publicApplyEnabled: z.boolean(),
});
export type RecruitingSettingsInput = z.infer<typeof recruitingSettingsSchema>;

// ── Super Admin: academy (tenant) management ─────────────────────────────────
export const planSchema = z.enum(["BASIC", "PRO", "ELITE"]);
export const academyStatusSchema = z.enum(["active", "inactive"]);

// Slug: lowercase letters, digits and single hyphens (no leading/trailing hyphen).
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug is too short.")
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.");

export const academyCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  slug: slugSchema,
  country: z.string().trim().min(2, "Country code is required.").max(2).toUpperCase(),
  location: optionalStr(120),
  plan: planSchema.default("BASIC"),
});

export const academyUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Name is required.").max(120),
  slug: slugSchema,
  logoColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Enter a hex colour like #7CFF6B."),
  status: academyStatusSchema,
  plan: planSchema,
});

export const academyStatusUpdateSchema = z.object({
  id: z.string().min(1),
  status: academyStatusSchema,
});

export const academyPlanUpdateSchema = z.object({
  id: z.string().min(1),
  plan: planSchema,
});

// ── Platform user/account management (super-admin) ───────────────────────────
export const userRoleSchema = z.enum(["super_admin", "academy_admin", "coach", "recruiter", "athlete"]);

// A password is optional on create/reset: blank → the account is "claimed" (the
// password is set) on first sign-in. When provided it must be at least 8 chars.
const optionalPassword = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : undefined))
  .refine((v) => v === undefined || v.length >= 8, { message: "Password must be at least 8 characters." });

// super_admin accounts are platform-level (no academy); every other role needs one.
export const userCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required.").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email."),
    role: userRoleSchema,
    academyId: z.string().optional().transform((v) => (v ? v : undefined)),
    password: optionalPassword,
  })
  .refine((d) => d.role === "super_admin" || !!d.academyId, {
    message: "Select an academy for this role.",
    path: ["academyId"],
  });

export const userUpdateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(2, "Name is required.").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email."),
    role: userRoleSchema,
    academyId: z.string().optional().transform((v) => (v ? v : undefined)),
  })
  .refine((d) => d.role === "super_admin" || !!d.academyId, {
    message: "Select an academy for this role.",
    path: ["academyId"],
  });

export const userPasswordSchema = z.object({
  id: z.string().min(1),
  // blank → clear the credential (force claim on next sign-in)
  password: optionalPassword,
});

export const userDeleteSchema = z.object({ id: z.string().min(1) });

// ── Academy onboarding requests (public submit + super-admin review) ─────────
export const academyRequestSchema = z.object({
  academyName: z.string().trim().min(2, "Academy name is required.").max(120),
  contactName: z.string().trim().min(2, "Your name is required.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  phone: optionalStr(40),
  country: z.string().trim().min(2, "Country code is required.").max(2).toUpperCase(),
  location: optionalStr(120),
  sport: z.string().trim().min(2).max(40).optional().transform((v) => (v ? v : "ski")),
  plan: planSchema.default("PRO"),
  message: optionalStr(1500),
});

export const academyRequestReviewSchema = z
  .object({
    id: z.string().min(1),
    action: z.enum(["approve", "reject"]),
    plan: planSchema.optional(),
    slug: z.string().optional().transform((v) => (v ? v : undefined)),
    reviewerNote: optionalStr(500),
  })
  .refine((d) => d.action !== "approve" || (!!d.slug && slugSchema.safeParse(d.slug).success), {
    message: "A valid slug is required to approve.",
    path: ["slug"],
  });

// ── Per-tenant configuration (super-admin): branding + feature flags + limit ──
export const academyConfigSchema = z.object({
  id: z.string().min(1),
  tagline: optionalStr(160),
  description: optionalStr(2000),
  contactEmail: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), { message: "Enter a valid email." }),
  logoColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Enter a hex colour like #7CFF6B."),
  featureRecruiting: z.boolean(),
  featurePublicProfiles: z.boolean(),
  featureFinance: z.boolean(),
  featureChat: z.boolean(),
  maxAthletes: z.number().int().min(0).max(100000).nullable().optional(),
  requiredDocs: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
});

// Public application form
export const applicationSchema = z
  .object({
    slug: z.string().min(1),
    firstName: z.string().trim().min(1, "First name is required.").max(80),
    lastName: z.string().trim().min(1, "Last name is required.").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    dob: optionalStr(20),
    nationality: optionalStr(2),
    sport: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : "ski")),
    discipline: optionalStr(40),
    currentRanking: optionalStr(120),
    fisCode: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || /^[A-Za-z0-9-]{3,12}$/.test(v), {
        message: "FIS code must be 3–12 letters/digits.",
      }),
    previousClub: optionalStr(160),
    motivation: optionalStr(2000),
    guardianName: optionalStr(120),
    guardianContact: optionalStr(160),
    mediaLink: optionalUrl,
    packageId: optionalStr(40),
    opportunityId: optionalStr(40),
    consent: z.string().optional(), // "on" when the consent box is ticked
  })
  .refine((d) => d.consent === "on", {
    message: "Please accept the data & privacy terms to apply.",
    path: ["consent"],
  })
  .refine((d) => Boolean(d.fisCode) || Boolean(d.dob && d.nationality && d.discipline), {
    message: "Provide a FIS code, or fill in date of birth, nationality and discipline.",
    path: ["dob"],
  })
  .refine((d) => !d.dob || !Number.isNaN(Date.parse(d.dob)), {
    message: "Enter a valid date of birth.",
    path: ["dob"],
  });

// Validated shape produced by any FIS provider before it is persisted.
export const fisAthleteDataSchema = z.object({
  fisCode: fisCodeSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  nation: z.string().length(2),
  gender: z.enum(["M", "F"]),
  birthYear: z.number().int().gte(1980).lte(new Date().getFullYear() - 10),
  discipline: z.string().min(1),
  currentPoints: z.number().nonnegative(),
  worldRank: z.number().int().positive(),
  history: z
    .array(z.object({ date: z.string(), fisPoints: z.number().nonnegative(), worldRank: z.number().int() }))
    .min(1),
  results: z.array(
    z.object({
      date: z.string(),
      eventName: z.string(),
      location: z.string(),
      discipline: z.string(),
      rank: z.number().int(),
      fisPoints: z.number().nonnegative(),
    }),
  ),
});

// ── Phase 4.5 operational mutations ──
const idField = z.string().min(1);
const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? v : null)); // "" → null (unassign)

export const enrollmentStatusSchema = z.object({
  enrollmentId: idField,
  status: z.enum(ENROLLMENT_STATUSES),
});

export const reassignSchema = z.object({
  enrollmentId: idField,
  target: z.enum(["group", "coach", "package"]),
  value: optionalId,
});

export const enrollmentNotesSchema = z.object({
  enrollmentId: idField,
  notes: z.string().trim().max(4000).optional().transform((v) => v ?? ""),
});

export const paymentStatusSchema = z.object({
  paymentId: idField,
  status: z.enum(["paid", "unpaid", "partial"]),
  amount: z.number().int().min(0).optional(), // collected amount (for partial)
  method: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
});

export const documentUpdateSchema = z.object({
  documentId: idField,
  status: z.enum(["missing", "uploaded", "verified", "expired"]),
  expiresAt: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), { message: "Invalid expiry date." }),
  fileUrl: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
});

// ── Entity CRUD (Phase 4.5) ──
const nullableId = z.string().optional().transform((v) => (v ? v : null));
const optText = (max = 200) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const coachInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().max(120).optional().transform((v) => (v ? v : null)).refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), { message: "Invalid email" }),
  phone: optText(40),
  role: z.enum(["head_coach", "coach", "physio", "s_and_c"]),
  specialization: optText(120),
  notes: optText(2000),
  active: z.boolean().optional().transform((v) => v ?? true),
});

const optInt = (min: number, max: number) =>
  z.number().int().min(min).max(max).nullable().optional().transform((v) => (v == null ? null : v));

export const groupInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  sport: z.string().trim().optional().transform((v) => v || "ski"),
  season: z.string().trim().min(1).max(20),
  coachId: nullableId,
  capacity: z.number().int().min(1).max(200),
  budget: optInt(0, 1000000000),
  budgetHardStop: z.boolean().optional().transform((v) => v ?? false),
  notes: optText(2000),
  active: z.boolean().optional().transform((v) => v ?? true),
  // Smart Group Assignment rules (all optional — null = no constraint)
  pointsMin: optInt(0, 100000),
  pointsMax: optInt(0, 100000),
  ageMin: optInt(0, 100),
  ageMax: optInt(0, 100),
  level: z.string().trim().max(20).nullable().optional().transform((v) => (v ? v : null)),
  discipline: z.string().trim().max(40).nullable().optional().transform((v) => (v ? v : null)),
});

export const packageInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: optText(500),
  price: z.number().int().min(0).nullable().optional().transform((v) => v ?? null),
  currency: z.string().trim().optional().transform((v) => v || "EUR"),
  period: z.enum(["season", "camp", "month"]),
  billingFreq: z.enum(["one_time", "monthly", "seasonal"]),
  features: optText(1000),
  accommodation: z.boolean().optional().transform((v) => v ?? false),
  transport: z.boolean().optional().transform((v) => v ?? false),
  coaching: z.boolean().optional().transform((v) => v ?? true),
  raceSupport: z.boolean().optional().transform((v) => v ?? false),
  maxAthletes: z.number().int().min(1).nullable().optional().transform((v) => v ?? null),
  active: z.boolean().optional().transform((v) => v ?? true),
});

export const manualAthleteSchema = z.object({
  firstName: z.string().trim().min(1, "First name required").max(80),
  lastName: z.string().trim().min(1, "Last name required").max(80),
  email: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  phone: optText(40),
  dob: z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: "Valid date of birth required" }),
  nationality: z.string().trim().length(2),
  gender: z.enum(["M", "F"]).optional().transform((v) => v ?? null),
  discipline: z.string().trim().min(1, "Discipline required"),
  sport: z.string().trim().optional().transform((v) => v || "ski"),
  level: z.string().trim().optional().transform((v) => (v ? v : null)),
  groupId: nullableId,
  coachId: nullableId,
  packageId: nullableId,
});

// Tennis (and future coach-driven sports) profile — all optional, ignored
// for ski-only athletes. Levels are coach-rated 1..10.
const levelField = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === null) return null;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  })
  .refine((v) => v === null || (v >= 1 && v <= 10), { message: "Level must be 1–10." });

export const athleteUpdateSchema = z.object({
  athleteId: z.string().min(1),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  phone: optText(40),
  nationality: z.string().trim().length(2),
  discipline: z.string().trim().min(1),
  emergencyContact: optText(160),
  guardianName: optText(120),
  guardianContact: optText(160),
  // Tennis profile — optional across the board so ski athletes are unaffected.
  dominantHand: z.enum(["right", "left", "ambidextrous"]).optional().nullable().transform((v) => v ?? null),
  playingStyle: optText(120),
  technicalLevel: levelField,
  tacticalLevel: levelField,
  physicalLevel: levelField,
  mentalLevel: levelField,
  developmentGoals: optText(1500),
  // Season goals — narrative intent the athlete sets for the season. Used
  // by both ski + tennis (universal). Surfaced on the athlete profile.
  seasonGoals: optText(1500),
});

export const applicationUpdateSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum(STATUSES).optional(),
  programId: nullableId,
  packageId: nullableId,
  score: z.number().int().min(0).max(100).nullable().optional().transform((v) => v ?? null),
  message: optText(2000),
});

export const chatMessageSchema = z.object({
  conversationId: idField,
  body: z.string().trim().min(1, "Message cannot be empty").max(4000),
});

export const conversationStatusSchema = z.object({
  conversationId: idField,
  status: z.enum(["open", "waiting", "resolved"]),
});

// ── Revenue (income tracker — sponsor / federation / academy allocation / …)
// Athlete fees flow through Payment per-enrollment; everything else (sponsor
// deals, federation grants, academy allocations, misc revenue) is captured
// here so the Budget Tracker shows a real net result per team.
export const REVENUE_CATEGORIES = ["athlete_fee", "sponsor", "federation", "academy_allocation", "other"] as const;
export const REVENUE_STATUSES = ["received", "pledged", "cancelled"] as const;

export const revenueInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(120),
  amount: z.number().int().min(1, "Amount must be positive."),
  currency: z.string().trim().optional().transform((v) => v || "EUR"),
  category: z.enum(REVENUE_CATEGORIES).optional().transform((v) => v ?? "other"),
  status: z.enum(REVENUE_STATUSES).optional().transform((v) => v ?? "received"),
  groupId: nullableId,
  source: optText(120),
  notes: optText(1000),
  receivedDate: z.string().trim().optional().transform((v) => (v ? v : undefined)),
});
export type RevenueInput = z.infer<typeof revenueInputSchema>;
export const revenueUpdateSchema = revenueInputSchema.extend({ id: z.string().min(1) });
export type RevenueUpdateInput = z.infer<typeof revenueUpdateSchema>;
export const revenueDeleteSchema = z.object({ id: z.string().min(1) });

export const expenseInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  amount: z.number().int().min(1, "Amount must be positive"),
  currency: z.string().trim().optional().transform((v) => v || "EUR"),
  category: z
    .enum(["coaching", "housing", "accommodation", "lift_pass", "fuel", "transport", "equipment", "race_cost", "sport_ops", "other", "hotel", "travel"])
    .optional()
    .transform((v) => v ?? "other"),
  groupId: nullableId,
  notes: optText(1000),
  expenseDate: z.string().trim().optional().transform((v) => (v ? v : undefined)),
  receiptUrl: optionalUrl,
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

// ── Calendar events (training / camp / race / travel / meeting / off) ───────
const optMoney = z.number().int().min(0).max(100_000_000).nullable().optional().transform((v) => v ?? null);
export const calendarEventSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  type: z.enum(["training", "camp", "race", "travel", "meeting", "off", "other"]).optional().transform((v) => v ?? "training"),
  season: z.enum(["summer", "autumn", "winter", "spring", "all"]).optional().transform((v) => v ?? "all"),
  startDate: z.string().trim().min(1, "Start date is required"),
  endDate: z.string().trim().optional().transform((v) => (v ? v : undefined)),
  groupId: z.string().trim().optional().transform((v) => (v ? v : null)),
  location: optText(160),
  planBLocation: optText(160),
  discipline: optText(40),
  coachesNote: optText(200),
  notes: optText(2000),
  // Cost breakdown — all optional, default to 0 in the action.
  costHotel: optMoney,
  costFlights: optMoney,
  costVan: optMoney,
  costFuel: optMoney,
  costLiftPass: optMoney,
  costCoach: optMoney,
  costAccommodation: optMoney,
  costRaceFees: optMoney,
  costMisc: optMoney,
  estimatedCost: optMoney,
  actualCost: optMoney,
})
.refine((d) => !Number.isNaN(Date.parse(d.startDate)), { message: "Invalid start date.", path: ["startDate"] })
.refine((d) => !d.endDate || !Number.isNaN(Date.parse(d.endDate)), { message: "Invalid end date.", path: ["endDate"] })
.refine((d) => !d.endDate || +new Date(d.endDate) >= +new Date(d.startDate), { message: "End date is before start.", path: ["endDate"] });
export type CalendarEventInput = z.infer<typeof calendarEventSchema>;

export type CoachInput = z.infer<typeof coachInputSchema>;
export type GroupInput = z.infer<typeof groupInputSchema>;
export type PackageInput = z.infer<typeof packageInputSchema>;
export type ManualAthleteInput = z.infer<typeof manualAthleteSchema>;

export type ApplicationInput = z.infer<typeof applicationSchema>;

// ── Contracts ────────────────────────────────────────────────────────────────
export const CONTRACT_STATUSES = ["draft", "sent", "signed", "expired"] as const;
export const contractStatusSchema = z.enum(CONTRACT_STATUSES);

export const contractCreateSchema = z.object({
  enrollmentId: z.string().min(1),
  title: z.string().trim().min(2, "Title is required.").max(120),
  status: contractStatusSchema.default("draft"),
  startDate: optionalStr(30),
  endDate: optionalStr(30),
  value: z.number().int().min(0).max(100000000).nullable().optional(),
  currency: z.string().trim().max(8).optional().transform((v) => (v ? v : "EUR")),
  notes: optionalStr(1000),
});

export const contractUpdateSchema = contractCreateSchema.extend({ id: z.string().min(1) }).omit({ enrollmentId: true });
export const contractStatusUpdateSchema = z.object({ id: z.string().min(1), status: contractStatusSchema });

export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;

// ── Coach Intelligence — Adaptive Coach Notes ────────────────────────────
// The composer keeps the input deliberately loose: free text + optional
// kind hint + zero-to-many attachment links. The structurer downstream
// decides everything else dynamically.
const coachNoteKindEnum = z.enum([
  "training_session",
  "race",
  "match",
  "video_review",
  "physical_block",
  "testing",
  "other",
]);

export const coachNoteAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  url: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .max(800),
  mimeType: z.string().trim().max(120).optional(),
  size: z.number().int().nonnegative().optional(),
});

export const coachNoteCreateSchema = z.object({
  athleteId: z.string().min(1),
  rawText: z.string().trim().min(3, "The note is too short.").max(8000),
  kind: coachNoteKindEnum.optional(),
  attachments: z.array(coachNoteAttachmentSchema).max(8).optional(),
});

export type CoachNoteCreateInput = z.infer<typeof coachNoteCreateSchema>;

export const coachNoteDeleteSchema = z.object({ id: z.string().min(1) });
export type CoachNoteDeleteInput = z.infer<typeof coachNoteDeleteSchema>;

// ── Tennis Match record ──────────────────────────────────────────────────
export const tennisMatchCreateSchema = z.object({
  athleteId: z.string().min(1),
  date: z.string().min(1),
  opponent: z.string().trim().min(1).max(120),
  result: z.enum(["won", "lost"]),
  score: optText(60),
  surface: z.enum(["hard", "clay", "grass", "indoor"]).optional().nullable().transform((v) => v ?? null),
  notes: optText(800),
});
export type TennisMatchCreateInput = z.infer<typeof tennisMatchCreateSchema>;
export const tennisMatchDeleteSchema = z.object({ id: z.string().min(1) });
export type TennisMatchDeleteInput = z.infer<typeof tennisMatchDeleteSchema>;

// Returns the first human-readable error message from a ZodError.
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

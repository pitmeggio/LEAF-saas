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

export const groupInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  sport: z.string().trim().optional().transform((v) => v || "ski"),
  season: z.string().trim().min(1).max(20),
  coachId: nullableId,
  capacity: z.number().int().min(1).max(200),
  notes: optText(2000),
  active: z.boolean().optional().transform((v) => v ?? true),
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

export const expenseInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  amount: z.number().int().min(1, "Amount must be positive"),
  currency: z.string().trim().optional().transform((v) => v || "EUR"),
  category: z.enum(["travel", "equipment", "accommodation", "other"]).optional().transform((v) => v ?? "other"),
  groupId: nullableId,
  notes: optText(1000),
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export type CoachInput = z.infer<typeof coachInputSchema>;
export type GroupInput = z.infer<typeof groupInputSchema>;
export type PackageInput = z.infer<typeof packageInputSchema>;
export type ManualAthleteInput = z.infer<typeof manualAthleteSchema>;

export type ApplicationInput = z.infer<typeof applicationSchema>;

// Returns the first human-readable error message from a ZodError.
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

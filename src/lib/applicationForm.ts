// Config-driven application form (per-academy).
// DB-free so it can be imported by the app, server actions AND prisma/seed.ts.
// Do NOT import the db client or "@/..." aliases here.
//
// Model: a small set of CORE identity fields is always present (needed to create
// the Athlete + Application). Beyond that, every field is a STANDARD field (maps
// to an existing column) or a CUSTOM field (academy-defined, answer stored in
// Application.customFields JSON). Academies toggle/require fields and add custom
// questions; the public form and the dashboard builder both read this resolver.

export type FieldType = "text" | "textarea" | "email" | "url" | "tel" | "date" | "select" | "number";

export type ApplicationFieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  enabled: boolean;
  required: boolean;
  custom?: boolean; // academy-defined question (answer → customFields JSON)
  locked?: boolean; // structurally required identity field — cannot be disabled/removed
  options?: string[]; // for select
  placeholder?: string;
  help?: string;
};

// Where a STANDARD field's answer is persisted. "athlete"/"application" → a real
// column; "custom" is implied for academy-defined fields (→ customFields JSON).
export type StandardStorage = { model: "athlete" | "application"; column: string };

// Sport-data fields are auto-filled from a FIS import, so they are hidden when the
// applicant supplies a federation code. Everything else is always shown (if enabled).
type StandardDef = ApplicationFieldConfig & {
  section: "sport" | "background" | "guardian";
  hideWithFis: boolean;
  storage: StandardStorage;
  /** Standard fields can be disabled/required-toggled but never deleted or relabelled away. */
  locked?: boolean; // core identity — not configurable
};

// ── CORE identity (always present, not configurable) ─────────────────────────
export const CORE_FIELDS: StandardDef[] = [
  { key: "firstName", label: "First name", type: "text", enabled: true, required: true, locked: true, section: "background", hideWithFis: false, storage: { model: "application", column: "_firstName" } },
  { key: "lastName", label: "Last name", type: "text", enabled: true, required: true, locked: true, section: "background", hideWithFis: false, storage: { model: "application", column: "_lastName" } },
  { key: "email", label: "Email", type: "email", enabled: true, required: true, locked: true, section: "background", hideWithFis: false, storage: { model: "application", column: "_email" } },
];

// ── STANDARD catalog (toggleable / requireable per academy) ──────────────────
// `enabled`/`required` here are the platform DEFAULTS (mirror today's form).
export const STANDARD_FIELDS: StandardDef[] = [
  // dob / nationality / discipline are structurally required to create the Athlete on
  // the manual (non-FIS) path, so they are locked: always shown, never disableable.
  { key: "dob", label: "Date of birth", type: "date", enabled: true, required: true, locked: true, section: "sport", hideWithFis: true, storage: { model: "athlete", column: "dob" } },
  { key: "nationality", label: "Nationality", type: "select", enabled: true, required: true, locked: true, section: "sport", hideWithFis: true, storage: { model: "athlete", column: "nationality" } },
  { key: "sport", label: "Sport", type: "select", enabled: true, required: false, section: "sport", hideWithFis: true, storage: { model: "athlete", column: "sport" } },
  { key: "discipline", label: "Discipline / category", type: "select", enabled: true, required: true, locked: true, section: "sport", hideWithFis: true, storage: { model: "athlete", column: "discipline" } },
  { key: "currentRanking", label: "Current ranking / points", type: "text", enabled: true, required: false, section: "sport", hideWithFis: true, placeholder: "e.g. 28.4 FIS pts · NR 142", storage: { model: "application", column: "currentRanking" } },
  { key: "previousClub", label: "Previous academy / club", type: "text", enabled: true, required: false, section: "background", hideWithFis: false, placeholder: "e.g. Hafjell Ski Club", storage: { model: "application", column: "previousClub" } },
  { key: "motivation", label: "Short motivation", type: "textarea", enabled: true, required: false, section: "background", hideWithFis: false, placeholder: "Why do you want to join, and what are your goals?", storage: { model: "application", column: "message" } },
  { key: "mediaLink", label: "Video / documents link", type: "url", enabled: true, required: false, section: "background", hideWithFis: false, placeholder: "https://…", storage: { model: "application", column: "mediaLink" } },
  { key: "guardianName", label: "Guardian name", type: "text", enabled: true, required: false, section: "guardian", hideWithFis: false, storage: { model: "application", column: "guardianName" } },
  { key: "guardianContact", label: "Guardian contact (email / phone)", type: "text", enabled: true, required: false, section: "guardian", hideWithFis: false, storage: { model: "application", column: "guardianContact" } },
];

const STANDARD_BY_KEY: Record<string, StandardDef> = Object.fromEntries(
  STANDARD_FIELDS.map((f) => [f.key, f]),
);

// Storage lookup for standard keys (used by the submit action to route answers).
export function standardStorage(key: string): StandardStorage | null {
  return STANDARD_BY_KEY[key]?.storage ?? null;
}

export function fieldSection(key: string): StandardDef["section"] {
  return STANDARD_BY_KEY[key]?.section ?? "background";
}

export function fieldHidesWithFis(key: string): boolean {
  return STANDARD_BY_KEY[key]?.hideWithFis ?? false;
}

export function isLockedField(key: string): boolean {
  return STANDARD_BY_KEY[key]?.locked ?? false;
}

// Public config view of a standard def (drops the server-only metadata).
function toPublic(def: StandardDef): ApplicationFieldConfig {
  const { section, hideWithFis, storage, ...pub } = def;
  void section; void hideWithFis; void storage;
  return { ...pub };
}

// The default form config = every standard field at its platform default.
export function defaultApplicationFields(): ApplicationFieldConfig[] {
  return STANDARD_FIELDS.map(toPublic);
}

const FIELD_TYPES = new Set<FieldType>(["text", "textarea", "email", "url", "tel", "date", "select", "number"]);
const CUSTOM_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

// Sanitize one raw field config entry (defensive — JSON from the DB is untrusted).
function sanitizeField(raw: unknown): ApplicationFieldConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const key = typeof r.key === "string" ? r.key.trim() : "";
  if (!key) return null;
  const std = STANDARD_BY_KEY[key];
  const custom = !std;
  if (custom && !CUSTOM_KEY_RE.test(key)) return null; // custom keys: safe identifiers only
  const locked = std?.locked ?? false;
  const type = FIELD_TYPES.has(r.type as FieldType) ? (r.type as FieldType) : std?.type ?? "text";
  const label = typeof r.label === "string" && r.label.trim() ? r.label.trim() : std?.label ?? key;
  const options = Array.isArray(r.options) ? r.options.filter((o): o is string => typeof o === "string") : undefined;
  return {
    key,
    label,
    type,
    // Locked identity fields are always enabled + required (the data model needs them).
    enabled: locked ? true : typeof r.enabled === "boolean" ? r.enabled : true,
    required: locked ? true : typeof r.required === "boolean" ? r.required : false,
    custom,
    ...(locked ? { locked: true } : {}),
    ...(options && options.length ? { options } : {}),
    ...(typeof r.placeholder === "string" ? { placeholder: r.placeholder } : std?.placeholder ? { placeholder: std.placeholder } : {}),
    ...(typeof r.help === "string" ? { help: r.help } : {}),
  };
}

// Resolve an academy's stored applicationConfig (Json | null) into the ordered list
// of fields to render. Falls back to the platform default. Always safe.
export function resolveApplicationFields(raw: unknown): ApplicationFieldConfig[] {
  const rawFields =
    raw && typeof raw === "object" && Array.isArray((raw as { fields?: unknown }).fields)
      ? ((raw as { fields: unknown[] }).fields)
      : null;
  if (!rawFields) return defaultApplicationFields();
  const seen = new Set<string>();
  const out: ApplicationFieldConfig[] = [];
  for (const entry of rawFields) {
    const f = sanitizeField(entry);
    if (f && !seen.has(f.key)) {
      seen.add(f.key);
      out.push(f);
    }
  }
  if (!out.length) return defaultApplicationFields();
  // Guarantee every locked identity field is present + enabled, even if a stored
  // config tried to drop it (defensive — keeps athlete creation working).
  for (const def of STANDARD_FIELDS) {
    if (def.locked && !seen.has(def.key)) out.unshift(toPublic(def));
  }
  return out;
}

// Extract academy-defined custom answers from submitted form data. Only keys that
// correspond to an enabled custom field in the resolved config are kept (prevents
// arbitrary data injection). Returns null when there are none.
export function extractCustomAnswers(
  fields: ApplicationFieldConfig[],
  get: (name: string) => string | null,
): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (!f.enabled || !f.custom) continue;
    const v = (get(`custom_${f.key}`) ?? "").trim();
    if (v) out[f.key] = v;
  }
  return Object.keys(out).length ? out : null;
}

// Server-side required check for enabled custom fields (browser `required` is
// bypassable). Returns the label of the first missing required field, or null.
export function firstMissingCustom(
  fields: ApplicationFieldConfig[],
  answers: Record<string, string> | null,
): string | null {
  for (const f of fields) {
    if (f.enabled && f.custom && f.required && !(answers && answers[f.key])) return f.label;
  }
  return null;
}

// Serialize a builder-edited field list back to the stored JSON shape.
export function toApplicationConfig(fields: ApplicationFieldConfig[]): { fields: ApplicationFieldConfig[] } {
  return { fields };
}

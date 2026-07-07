// Client-safe types + labels for the Anagrafica module (document types + expiry
// alerts). No prisma import so client components can use these freely.

export type DocType = "tessera_fitp" | "ipin" | "medical" | "passport" | "id_card" | "insurance" | "other";

export const DOC_TYPE_META: Record<DocType, { label: string; short: string; emoji: string }> = {
  tessera_fitp: { label: "Tessera FIT", short: "Tessera FIT", emoji: "🎾" },
  ipin: { label: "iPin ITF", short: "iPin", emoji: "🌍" },
  medical: { label: "Certificato medico", short: "Cert. medico", emoji: "🩺" },
  passport: { label: "Passaporto", short: "Passaporto", emoji: "🛂" },
  id_card: { label: "Carta d'identità", short: "Carta ID", emoji: "🪪" },
  insurance: { label: "Assicurazione", short: "Assicur.", emoji: "🛡️" },
  other: { label: "Altro documento", short: "Altro", emoji: "📄" },
};

export const DOC_TYPE_ORDER: DocType[] = ["tessera_fitp", "ipin", "medical", "passport", "id_card", "insurance", "other"];

export function docLabel(t: string | null | undefined): string {
  return (t && DOC_TYPE_META[t as DocType]?.label) || "Documento";
}

export type ExpiryStatus = "expired" | "expiring" | "ok";

// A document/tessera whose renewal deadline is near or past.
export type ExpiryAlert = {
  athleteId: string;
  athleteName: string;
  kind: DocType;
  label: string;
  expiresAt: string; // ISO
  daysLeft: number; // negative = already expired
  status: Exclude<ExpiryStatus, "ok">;
  source: "athlete" | "file"; // athlete = fitTesseraExpiry/ipinExpiry field; file = AthleteFile
};

// Days-before-deadline that flips a document into the "expiring soon" warning.
export const EXPIRY_WARN_DAYS = 30;

export function expiryStatus(daysLeft: number): ExpiryStatus {
  if (daysLeft < 0) return "expired";
  if (daysLeft <= EXPIRY_WARN_DAYS) return "expiring";
  return "ok";
}

export const EXPIRY_COLOR: Record<Exclude<ExpiryStatus, "ok">, string> = {
  expired: "#ef5f6b",
  expiring: "#f5a623",
};

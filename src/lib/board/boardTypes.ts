// Client-safe types + labels for the Bacheca (Squad Board) module. No prisma
// import here so client components can pull these without dragging `pg` into
// the browser bundle (mirrors the dossierTypes / wellnessCore split).

export type RsvpStatus = "going" | "not" | "maybe";

export const RSVP_META: Record<RsvpStatus, { label: string; short: string; color: string; icon: string }> = {
  going: { label: "Ci sono", short: "Presente", color: "#3ecf8e", icon: "✓" },
  maybe: { label: "Forse", short: "Forse", color: "#f5a623", icon: "?" },
  not: { label: "Non ci sono", short: "Assente", color: "#ef5f6b", icon: "✕" },
};

export const RSVP_ORDER: RsvpStatus[] = ["going", "maybe", "not"];

export type Audience = "all" | "group";

// A single announcement as the athlete sees it, with their own read/ack state.
export type AnnouncementView = {
  id: string;
  title: string;
  body: string;
  authorName: string;
  authorRole: string | null;
  audienceLabel: string;      // "Tutta l'academy" | group name
  pinned: boolean;
  requireAck: boolean;
  createdAt: string;          // ISO
  read: boolean;
  acked: boolean;
};

// Read/ack roll-up for staff — the "seen by / confirmed by" panel.
export type ReceiptStat = {
  id: string;
  title: string;
  body: string;
  authorName: string;
  authorRole: string | null;
  audienceLabel: string;
  pinned: boolean;
  requireAck: boolean;
  createdAt: string;
  audienceSize: number;       // how many athletes it targets
  readCount: number;
  ackCount: number;
};

export type StaffBoard = {
  announcements: ReceiptStat[];
  groups: { id: string; name: string }[];   // for the compose audience picker
  rosterSize: number;
};

// Per-event RSVP roll-up for staff (attendance forecast).
export type RsvpSummary = {
  going: number;
  maybe: number;
  not: number;
  pending: number;            // roster not yet responded
  responders: { athleteId: string; name: string; status: RsvpStatus }[];
};

export function relativeTime(iso: string, nowMs: number): string {
  const diff = nowMs - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} g fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

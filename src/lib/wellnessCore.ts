// Pure wellness/readiness math + labels. No prisma — safe to import in the
// athlete check-in client component (for instant local preview) AND in the
// server read layer (src/lib/wellness.ts).

export type WellnessMetrics = {
  sleepQuality: number; // 1–5
  soreness: number;     // 1–5 (higher = worse)
  energy: number;       // 1–5
  mood: number;         // 1–5
  stress: number;       // 1–5 (higher = worse)
  sleepHours?: number | null;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const up = (v: number) => clamp01((v - 1) / 4);      // 1..5 → 0..1
const down = (v: number) => clamp01((5 - v) / 4);    // 1..5 → 1..0 (invert)

// 0–100 readiness. Energy + soreness + sleep dominate; mood + stress temper it.
// sleepHours (when given) refines the sleep signal against an 8h target.
export function computeReadiness(m: WellnessMetrics): number {
  const sleepHr = m.sleepHours != null ? clamp01(m.sleepHours / 8) : up(m.sleepQuality);
  const score =
    0.24 * up(m.energy) +
    0.20 * down(m.soreness) +
    0.18 * up(m.sleepQuality) +
    0.14 * up(m.mood) +
    0.12 * down(m.stress) +
    0.12 * sleepHr;
  return Math.round(clamp01(score) * 100);
}

export type ReadinessBand = "good" | "watch" | "low";
export function readinessBand(r: number | null | undefined): ReadinessBand {
  if (r == null) return "watch";
  if (r >= 67) return "good";
  if (r >= 40) return "watch";
  return "low";
}
export const BAND_COLOR: Record<ReadinessBand, string> = {
  good: "var(--color-accent)",
  watch: "#f59e0b",
  low: "#f87171",
};
export const BAND_LABEL: Record<ReadinessBand, string> = {
  good: "Pronto",
  watch: "Attenzione",
  low: "A rischio",
};

// The five 1–5 sliders the athlete taps. `invert` metrics read best at 1.
export const WELLNESS_ITEMS = [
  { key: "sleepQuality", label: "Sonno", emoji: "😴", invert: false },
  { key: "energy", label: "Energia", emoji: "⚡️", invert: false },
  { key: "soreness", label: "Dolori muscolari", emoji: "💪", invert: true },
  { key: "mood", label: "Umore", emoji: "🙂", invert: false },
  { key: "stress", label: "Stress", emoji: "🧠", invert: true },
] as const;

export type WellnessItemKey = (typeof WELLNESS_ITEMS)[number]["key"];

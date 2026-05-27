import { test } from "node:test";
import assert from "node:assert/strict";

import { computePointsTrendByDiscipline, pointsTrendHeadline } from "@/lib/ai/pointsTrend";

const snap = (publishedAt: string, discipline: string, fisPoints: number, worldRank: number | null = null) =>
  ({ publishedAt: new Date(publishedAt), discipline, fisPoints, worldRank });

test("trend: 4 GS snapshots dropping → improving + delta", () => {
  const t = computePointsTrendByDiscipline([
    snap("2025-11-01", "giant_slalom", 12.5),
    snap("2026-01-01", "giant_slalom", 10.2),
    snap("2026-02-15", "giant_slalom", 8.7),
    snap("2026-04-01", "giant_slalom", 7.0),
  ]);
  assert.equal(t.length, 1);
  const gs = t[0];
  assert.equal(gs.discipline, "giant_slalom");
  assert.equal(gs.trend, "improving");
  assert.equal(gs.current, 7.0);
  assert.equal(gs.earliest, 12.5);
  assert.equal(gs.delta, -5.5);
  assert.equal(gs.sampleSize, 4);
  // Series ordered oldest → newest for sparkline.
  assert.equal(gs.series[0].fisPoints, 12.5);
  assert.equal(gs.series[3].fisPoints, 7.0);
});

test("trend: rising points → declining label (FIS: lower = better)", () => {
  const t = computePointsTrendByDiscipline([
    snap("2025-11-01", "slalom", 8.0),
    snap("2026-01-15", "slalom", 10.5),
    snap("2026-03-01", "slalom", 13.2),
  ]);
  assert.equal(t[0].trend, "declining");
  assert.equal(t[0].delta, 5.2);
});

test("trend: ±0.5 band counts as stable", () => {
  const t = computePointsTrendByDiscipline([
    snap("2025-11-01", "super_g", 22.0),
    snap("2026-03-01", "super_g", 22.3),
  ]);
  assert.equal(t[0].trend, "stable");
});

test("trend: single snapshot → insufficient_data", () => {
  const t = computePointsTrendByDiscipline([snap("2026-03-01", "downhill", 30.0)]);
  assert.equal(t[0].trend, "insufficient_data");
  assert.equal(t[0].sampleSize, 1);
});

test("trend: multi-discipline sorted by strongest (lowest current)", () => {
  const t = computePointsTrendByDiscipline([
    snap("2026-04-01", "downhill", 35.0),
    snap("2025-11-01", "downhill", 40.0),
    snap("2026-04-01", "giant_slalom", 8.0),
    snap("2025-11-01", "giant_slalom", 12.0),
    snap("2026-04-01", "slalom", 20.0),
    snap("2025-11-01", "slalom", 18.0),
  ]);
  // GS (8.0) first, then SL (20.0), then DH (35.0).
  assert.deepEqual(
    t.map((x) => x.discipline),
    ["giant_slalom", "slalom", "downhill"],
  );
});

test("headline: GS improving + SL stable produces compact string", () => {
  const t = computePointsTrendByDiscipline([
    snap("2025-11-01", "giant_slalom", 12),
    snap("2026-03-01", "giant_slalom", 8),
    snap("2025-11-01", "slalom", 15),
    snap("2026-03-01", "slalom", 15.2),
  ]);
  const h = pointsTrendHeadline(t);
  assert.match(h, /GS improving/);
  assert.match(h, /SL stable/);
});

test("headline: empty input returns a safe sentinel", () => {
  assert.equal(pointsTrendHeadline([]), "No FIS history yet");
});

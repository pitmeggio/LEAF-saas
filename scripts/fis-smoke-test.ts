// Live smoke test for the FIS provider — exercises the real fis-ski.com
// API and prints what comes back. Run with:
//
//   npx tsx scripts/fis-smoke-test.ts [fisCode] [fisCode...]
//
// Defaults to a handful of well-known FIS codes (Kristoffersen, Brignone,
// Kilde) when no args are passed. Exits non-zero on any failure so this
// can also be wired into CI.

import { liveFisProvider } from "../src/lib/fis/liveProvider.js";
import { computePointsTrendByDiscipline, pointsTrendHeadline } from "../src/lib/ai/pointsTrend.js";

const DEFAULT_CODES = [
  "422732", // Henrik Kristoffersen — NOR (tech)
  "297601", // Federica Brignone — ITA (all-round)
  "422310", // Aleksander Aamodt Kilde — NOR (speed)
];

function fmt(n: number | null | undefined, suffix = ""): string {
  if (n == null || !Number.isFinite(n as number)) return "—";
  return `${(n as number).toFixed(2)}${suffix}`;
}

async function run() {
  const codes = process.argv.slice(2);
  const targets = codes.length > 0 ? codes : DEFAULT_CODES;

  for (const code of targets) {
    console.log("");
    console.log("──────────────────────────────────────────────────────────────");
    console.log(`FIS code: ${code}`);
    const t0 = Date.now();
    const data = await liveFisProvider.fetchByCode(code);
    const t1 = Date.now();
    if (!data) {
      console.log(`  ✗ Not found (or FIS unreachable). ${t1 - t0}ms`);
      continue;
    }
    console.log(
      `  ✓ ${data.firstName} ${data.lastName} · ${data.nation} · ${data.gender} · b. ${data.birthYear}`,
    );
    console.log(
      `    primary discipline: ${data.discipline} · ${fmt(data.currentPoints)} pts · rank ${data.worldRank}`,
    );
    console.log(`    latest list snapshot fetched in ${t1 - t0}ms`);

    const h0 = Date.now();
    const lookback = Number(process.env.LOOKBACK ?? "4");
    const snapshots = await liveFisProvider.fetchHistoryByCode(code, lookback);
    const h1 = Date.now();
    if (snapshots.length === 0) {
      console.log(`  ✗ No multi-list history available. ${h1 - h0}ms`);
      continue;
    }
    const lists = new Set(snapshots.map((s) => s.listid));
    console.log(
      `  ✓ history: ${snapshots.length} snapshots across ${lists.size} lists, ${h1 - h0}ms`,
    );
    // Print which lists were actually read (sanity-check that we are NOT
    // reading the same list 4 times — a regex bug would silently fake this).
    const listSummary = [...lists].sort((a, b) => b - a).map((id) => {
      const sample = snapshots.find((s) => s.listid === id)!;
      const dt = new Date(sample.publishedAt).toISOString().slice(0, 10);
      return `${id}@${dt}`;
    });
    console.log(`    lists: ${listSummary.join(", ")}`);

    const trends = computePointsTrendByDiscipline(
      snapshots.map((s) => ({
        publishedAt: new Date(s.publishedAt),
        discipline: s.discipline,
        fisPoints: s.fisPoints,
        worldRank: s.worldRank,
      })),
    );
    console.log(`    headline: ${pointsTrendHeadline(trends)}`);
    for (const t of trends) {
      const sign = t.delta < 0 ? "↘" : t.delta > 0 ? "↗" : "→";
      const dir = t.delta < 0 ? "improving" : t.delta > 0 ? "declining" : "flat";
      console.log(
        `    · ${t.label.padEnd(14)} ${fmt(t.current)} pts  (Δ ${t.delta >= 0 ? "+" : ""}${fmt(t.delta)} ${sign} ${dir} · ${t.sampleSize} snapshots · ${t.trend})`,
      );
    }
  }
  console.log("");
  console.log("Done.");
}

run().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});

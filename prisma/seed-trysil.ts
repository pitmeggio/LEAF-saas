import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Trysil Race Academy — first real tenant.
//
// Runs idempotently: every entity is upserted by a stable key (slug, email,
// composite name/academy) so re-running this script doesn't duplicate data.
// SAFE to run against a database with demo data — it only touches the rows
// it owns (slug = "trysilraceacademy").
//
// What this seeds:
//   • Academy "Trysil Race Academy" (NO, sport=ski, currency=NOK, plan=PRO)
//   • 4 teams: Tech Elite · Development 1 · Development 2 · Youth
//   • 5 packages with the real NOK prices from trysilraceacademy.no
//   • Marius (academy_admin + head coach record)
//   • AcademyBudgetBenchmarks pre-loaded from Marius's Excel
//
// What this does NOT do:
//   • Create athletes (intentional — Marius adds them, or we add later)
//   • Wipe demo data (use the regular seed.ts if you want a clean DB)
//
// Run with:
//   npx tsx prisma/seed-trysil.ts
//
// The .env DATABASE_URL must point at the Supabase database. Use the SESSION
// pooler (port 5432) if you've also run `prisma db push` recently.

function seedConnectionString(): string {
  const raw = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set — see the README.");
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: seedConnectionString(), ssl: { rejectUnauthorized: false } }),
});

const ACADEMY_SLUG = "trysilraceacademy";
const MARIUS_EMAIL = "marius@trysilraceacademy.no";

async function main() {
  console.log("→ Upserting Trysil Race Academy…");

  const academy = await prisma.academy.upsert({
    where: { slug: ACADEMY_SLUG },
    update: {
      // Keep these fields in sync if you re-run the script — but don't
      // touch ones an admin may have edited in the UI (description, etc.).
      name: "Trysil Race Academy",
      country: "NO",
      location: "Trysil, Norway",
      sport: "ski",
      currency: "NOK",
      status: "active",
    },
    create: {
      name: "Trysil Race Academy",
      slug: ACADEMY_SLUG,
      country: "NO",
      location: "Trysil, Norway",
      sport: "ski",
      season: "2026/27",
      currency: "NOK",
      status: "active",
      plan: "PRO",
      logoColor: "#0066CC",
      tagline: "Where Norway's next alpine racers are made.",
      description:
        "Trysil Race Academy delivers full-time alpine ski racing programmes from U16 through to the national circuit. On-snow training, race support, S&C and video analysis — based at one of Norway's premier training venues.",
      contactEmail: "post@trysilraceacademy.no",
      featuredAcademy: true,
      publicApplyEnabled: true,
      recruitingEnabled: true,
      recruitingStatus: "OPEN",
      publicRecruitingHeadline: "Applications open for the 2026/27 season",
      publicRecruitingDescription:
        "We're recruiting committed skiers for our Tech Elite, Development and Youth programmes. Limited places — early applications reviewed first.",
      applicationDeadline: new Date("2026-04-26"),
      acceptedCountries: "NO, SE, FI, DK, AT, CH, IT, FR, DE",
      ageCategories: "U16, U18, U21, FIS",
      programTypes: "Full Package, Training Only, Race Support, Custom",
      featurePublicProfiles: false,
      featureFinance: true,
      featureChat: true,
      featureRecruiting: true,
    },
  });
  console.log("  ✓ Academy id:", academy.id);

  // ── Marius — academy admin + head coach ────────────────────────────────
  console.log("→ Upserting Marius (admin + head coach)…");
  const password = process.env.MARIUS_PASSWORD || "trysil2026";
  const passwordHash = await bcrypt.hash(password, 10);

  const headCoach = await prisma.coach.upsert({
    where: { id: `seed_trysil_head_${academy.id}` },
    update: { name: "Marius", role: "head_coach", cost: 40_000, specialization: "GS / SL — development" },
    create: {
      id: `seed_trysil_head_${academy.id}`,
      academyId: academy.id,
      name: "Marius",
      email: MARIUS_EMAIL,
      role: "head_coach",
      specialization: "GS / SL — development",
      cost: 40_000,
      active: true,
    },
  });
  console.log("  ✓ Head coach id:", headCoach.id);

  const assistant = await prisma.coach.upsert({
    where: { id: `seed_trysil_assist_${academy.id}` },
    update: { name: "Assistant Coach", role: "assistant_coach", cost: 33_000 },
    create: {
      id: `seed_trysil_assist_${academy.id}`,
      academyId: academy.id,
      name: "Assistant Coach",
      role: "assistant_coach",
      specialization: "Tactical / race support",
      cost: 33_000,
      active: true,
    },
  });
  console.log("  ✓ Assistant coach id:", assistant.id);

  await prisma.user.upsert({
    where: { email: MARIUS_EMAIL },
    update: {
      academyId: academy.id,
      role: "academy_admin",
      coachId: headCoach.id,
    },
    create: {
      name: "Marius",
      email: MARIUS_EMAIL,
      passwordHash,
      academyId: academy.id,
      role: "academy_admin",
      coachId: headCoach.id,
    },
  });
  console.log(`  ✓ Marius login: ${MARIUS_EMAIL} / ${password}`);

  // ── Teams (groups) ─────────────────────────────────────────────────────
  console.log("→ Upserting teams…");
  type TeamSeed = {
    id: string;
    name: string;
    capacity: number;
    level: string;
    pointsMin?: number;
    pointsMax?: number;
    ageMin?: number;
    ageMax?: number;
    coachId?: string;
    notes?: string;
  };
  const teams: TeamSeed[] = [
    { id: `seed_trysil_tech_${academy.id}`, name: "Tech Elite", capacity: 10, level: "elite", pointsMax: 40, ageMin: 16, coachId: headCoach.id, notes: "FIS points ≤ 40 — competitive tech squad." },
    { id: `seed_trysil_dev1_${academy.id}`, name: "Development 1", capacity: 10, level: "competitive", pointsMin: 40, pointsMax: 90, ageMin: 15, coachId: headCoach.id, notes: "Dev 1 — building toward national qualifiers." },
    { id: `seed_trysil_dev2_${academy.id}`, name: "Development 2", capacity: 10, level: "development", pointsMin: 90, ageMin: 14, coachId: assistant.id, notes: "Dev 2 — first FIS season, focus on volume + fundamentals." },
    { id: `seed_trysil_youth_${academy.id}`, name: "Youth", capacity: 12, level: "development", ageMax: 16, coachId: assistant.id, notes: "U16 — long-term development pipeline." },
  ];
  for (const t of teams) {
    await prisma.group.upsert({
      where: { id: t.id },
      update: { name: t.name, capacity: t.capacity, level: t.level, pointsMin: t.pointsMin ?? null, pointsMax: t.pointsMax ?? null, ageMin: t.ageMin ?? null, ageMax: t.ageMax ?? null, coachId: t.coachId ?? null, notes: t.notes ?? null },
      create: {
        id: t.id,
        academyId: academy.id,
        name: t.name,
        sport: "ski",
        season: "2026/27",
        capacity: t.capacity,
        coachId: t.coachId ?? null,
        level: t.level,
        pointsMin: t.pointsMin ?? null,
        pointsMax: t.pointsMax ?? null,
        ageMin: t.ageMin ?? null,
        ageMax: t.ageMax ?? null,
        notes: t.notes ?? null,
      },
    });
    console.log("  ✓ team:", t.name);
  }

  // ── Packages — real NOK prices from the Trysil website ────────────────
  console.log("→ Upserting packages…");
  type PkgSeed = {
    id: string;
    name: string;
    price: number;
    description: string;
    period: "season" | "camp" | "month";
    billingFreq: string;
    coaching: boolean;
    accommodation: boolean;
    transport: boolean;
    raceSupport: boolean;
    order: number;
  };
  const packages: PkgSeed[] = [
    { id: `seed_pkg_full_${academy.id}`, name: "Academy Full Year", price: 549_000, description: "Full 12-month programme — training, race support, accommodation, transport.", period: "season", billingFreq: "seasonal", coaching: true, accommodation: true, transport: true, raceSupport: true, order: 1 },
    { id: `seed_pkg_winter_${academy.id}`, name: "Academy Winter Season", price: 275_000, description: "Full winter season (Dec–Apr) — training, race support, accommodation, transport.", period: "season", billingFreq: "seasonal", coaching: true, accommodation: true, transport: true, raceSupport: true, order: 2 },
    { id: `seed_pkg_train_${academy.id}`, name: "Academy Training", price: 139_000, description: "Year-round training programme, no accommodation / transport.", period: "season", billingFreq: "seasonal", coaching: true, accommodation: false, transport: false, raceSupport: true, order: 3 },
    { id: `seed_pkg_trainw_${academy.id}`, name: "Academy Training Winter", price: 99_000, description: "Winter-only training programme.", period: "season", billingFreq: "seasonal", coaching: true, accommodation: false, transport: false, raceSupport: true, order: 4 },
    { id: `seed_pkg_youth_${academy.id}`, name: "Youth Team", price: 0, description: "U16 development programme — price on enquiry.", period: "season", billingFreq: "seasonal", coaching: true, accommodation: false, transport: false, raceSupport: false, order: 5 },
  ];
  for (const p of packages) {
    await prisma.package.upsert({
      where: { id: p.id },
      update: { name: p.name, price: p.price, description: p.description, order: p.order },
      create: {
        id: p.id,
        academyId: academy.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: "NOK",
        period: p.period,
        billingFreq: p.billingFreq,
        coaching: p.coaching,
        accommodation: p.accommodation,
        transport: p.transport,
        raceSupport: p.raceSupport,
        order: p.order,
        active: true,
      },
    });
    console.log("  ✓ package:", p.name, "·", p.price.toLocaleString("en"), "NOK");
  }

  // ── Cost benchmarks (from Marius's Excel) ──────────────────────────────
  console.log("→ Upserting cost benchmarks…");
  await prisma.academyBudgetBenchmarks.upsert({
    where: { academyId: academy.id },
    update: {
      pricePerNight: 1_000,
      liftPassPerDay: 350,
      mealsPerDay: 0,
      fuelPerTravelDay: 750,
      vanCostAnnual: 252_000,
      housingMonthly: 45_000,
      housingMonthsPerSeason: 8,
      clothingPerAthlete: 8_000,
      headCoachMonthlyRate: 40_000,
      headCoachMonthsPerSeason: 12,
      assistantCoachMonthlyRate: 33_000,
      assistantCoachMonthsPerSeason: 8,
      miscAnnual: 100_000,
      sportOpsAnnual: 100_000,
      defaultTravelDaysPerSeason: 120,
      defaultRaceDaysPerSeason: 100,
      defaultNightsPerSeason: 90,
    },
    create: {
      academyId: academy.id,
      pricePerNight: 1_000,
      liftPassPerDay: 350,
      mealsPerDay: 0,
      fuelPerTravelDay: 750,
      vanCostAnnual: 252_000,
      housingMonthly: 45_000,
      housingMonthsPerSeason: 8,
      clothingPerAthlete: 8_000,
      headCoachMonthlyRate: 40_000,
      headCoachMonthsPerSeason: 12,
      assistantCoachMonthlyRate: 33_000,
      assistantCoachMonthsPerSeason: 8,
      miscAnnual: 100_000,
      sportOpsAnnual: 100_000,
      defaultTravelDaysPerSeason: 120,
      defaultRaceDaysPerSeason: 100,
      defaultNightsPerSeason: 90,
    },
  });
  console.log("  ✓ benchmarks loaded from Excel");

  console.log("");
  console.log("✓ Trysil Race Academy ready.");
  console.log("  Sign-in:  " + MARIUS_EMAIL);
  console.log("  Apply:    /academy/" + ACADEMY_SLUG + "/apply");
  console.log("");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

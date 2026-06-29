// Sport Team Padova — tenant tennis. Demo + operativo starter.
//
// Setup:
//   • Academy "Sport Team Padova", sport=tennis, tier=complete, currency=EUR
//   • Max Zanardi as head coach + admin user
//   • 9 athletes from Max's CALENDARI TORNEI.xlsx (Tommaso, Gabriele,
//     Pietro, Gianluca, Alberto, Isabella, Laura, Ventura, Gaffo).
//   • The full TennisTournament catalogue (~154 events) parsed once.
//   • Per-athlete TennisSeasonPlan with all entries from Max's grid.
//
// Run with:  npx tsx prisma/seed-sport-team.ts
//
// Re-runnable: upserts on stable IDs. Wipes only this academy's
// tennis catalogue + plans + entries; never touches ski tenants.

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import { parseTournamentCalendar, deriveCatalogue, type ParsedTournamentEntry } from "../src/lib/tournamentImport";

function connStr(): string {
  const raw = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set.");
  try { const u = new URL(raw); u.searchParams.delete("sslmode"); return u.toString(); } catch { return raw; }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: connStr(), ssl: { rejectUnauthorized: false } }),
});

const SLUG = "sportteam-padova";
const MAX_EMAIL = "max@sportteam.it";

async function main() {
  console.log("→ Upserting Sport Team Padova…");
  const academy = await prisma.academy.upsert({
    where: { slug: SLUG },
    update: {
      name: "Sport Team Padova",
      country: "IT",
      location: "Padova",
      sport: "tennis",
      tier: "complete",
      currency: "EUR",
      tagline: "Federazione Italiana Tennis · Elite Junior Programme",
      description: "Tennis academy in Veneto with full junior pipeline — ETA, ITF Junior, FIT national circuits. Head coach: Max Zanardi.",
      status: "active",
      plan: "ELITE",
      season: "2026",
      logoColor: "#a78bfa",
    },
    create: {
      slug: SLUG,
      name: "Sport Team Padova",
      country: "IT",
      location: "Padova",
      sport: "tennis",
      tier: "complete",
      currency: "EUR",
      tagline: "Federazione Italiana Tennis · Elite Junior Programme",
      description: "Tennis academy in Veneto with full junior pipeline — ETA, ITF Junior, FIT national circuits. Head coach: Max Zanardi.",
      status: "active",
      plan: "ELITE",
      season: "2026",
      logoColor: "#a78bfa",
    },
  });
  console.log("  ✓ academy id:", academy.id);

  console.log("→ Upserting Max (head coach + admin)…");
  const headCoach = await prisma.coach.upsert({
    where: { id: `seed_sportteam_head_${academy.id}` },
    update: { name: "Max Zanardi", role: "head_coach", specialization: "ITF junior / FIT national", cost: 4500 },
    create: {
      id: `seed_sportteam_head_${academy.id}`,
      academyId: academy.id,
      name: "Max Zanardi",
      role: "head_coach",
      specialization: "ITF junior / FIT national",
      cost: 4500,
      active: true,
    },
  });
  const pwd = process.env.MAX_PASSWORD || "padova2026";
  const passwordHash = await bcrypt.hash(pwd, 10);
  await prisma.user.upsert({
    where: { email: MAX_EMAIL },
    update: { name: "Max Zanardi", role: "academy_admin", academyId: academy.id, coachId: headCoach.id, passwordHash },
    create: { email: MAX_EMAIL, name: "Max Zanardi", role: "academy_admin", academyId: academy.id, coachId: headCoach.id, passwordHash },
  });
  console.log(`  ✓ Max login: ${MAX_EMAIL} / ${pwd}`);

  console.log("→ One team (Agonistica Elite) for the squad…");
  const teamId = `seed_sportteam_elite_${academy.id}`;
  await prisma.group.upsert({
    where: { id: teamId },
    update: { name: "Agonistica Elite", capacity: 15, level: "elite", coachId: headCoach.id },
    create: {
      id: teamId,
      academyId: academy.id,
      name: "Agonistica Elite",
      sport: "tennis",
      season: "2026",
      capacity: 15,
      coachId: headCoach.id,
      level: "elite",
      notes: "ITF Junior pipeline + FIT national circuits.",
    },
  });

  console.log("→ Parsing Max's CALENDARI TORNEI.xlsx…");
  const fp = path.join(process.env.HOME ?? "", "Downloads", "CALENDARI TORNEI.xlsx");
  if (!fs.existsSync(fp)) {
    console.log("  × file not found at", fp, "— skipping tournament import");
    console.log("");
    return;
  }
  const buf = fs.readFileSync(fp);
  const parsed = parseTournamentCalendar(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), { year: 2026 });
  console.log(`  ✓ ${parsed.plans.length} athlete plans, ${parsed.plans.reduce((s, p) => s + p.entries.length, 0)} entries`);

  // Wipe any prior import for this academy so we re-import cleanly.
  await prisma.tennisSeasonPlanEntry.deleteMany({ where: { plan: { academyId: academy.id } } });
  await prisma.tennisSeasonPlan.deleteMany({ where: { academyId: academy.id } });
  await prisma.tennisTournament.deleteMany({ where: { academyId: academy.id } });

  // Create the tournament catalogue (de-duped across athletes).
  const { catalogue, byKey } = deriveCatalogue(parsed.plans);
  const catalogueIdByKey = new Map<string, string>();
  for (const c of catalogue) {
    const created = await prisma.tennisTournament.create({
      data: {
        academyId: academy.id,
        name: c.name,
        category: c.category,
        location: c.location,
        startDate: c.startDate,
        endDate: c.endDate,
      },
    });
    catalogueIdByKey.set(c.key, created.id);
  }
  console.log(`  ✓ ${catalogue.length} tournaments in catalogue`);

  // Create athletes + season plans + entries.
  // We persist sheet name on Athlete.firstName/lastName for easy lookup in
  // the demo (no first/last split — Max's sheets are uppercase nicknames).
  let athleteCount = 0;
  let entryCount = 0;
  // Maintain a stable hue per athlete so the cross-athlete view colors stay consistent.
  const HUES: Record<string, string> = {
    TOMMY: "#7cff6b", PAGAN: "#38bdf8", CASCIARO: "#a78bfa", MILAN: "#f59e0b",
    RIGONI: "#f472b6", ISA: "#34d399", LAURA: "#facc15", VENTU: "#fb7185", GAFFO: "#60a5fa",
  };
  for (const plan of parsed.plans) {
    const sheet = plan.athleteSheet.toUpperCase();
    // Quick demographic fabrication so the cards look complete — Max can
    // overwrite each one from the UI later.
    const ageGroupGuess = sheet === "PAGAN" || sheet === "CASCIARO" ? 12
      : sheet === "RIGONI" ? 16
      : sheet === "TOMMY" || sheet === "LAURA" || sheet === "ISA" ? 17
      : 15;
    const yob = 2026 - ageGroupGuess;

    const athleteId = `seed_sportteam_${sheet.toLowerCase()}_${academy.id}`;
    await prisma.athlete.upsert({
      where: { id: athleteId },
      update: {
        firstName: plan.athleteDisplayName,
        lastName: "Sport Team",
        nationality: "ITA",
        sport: "tennis",
        discipline: "singles",
      },
      create: {
        id: athleteId,
        firstName: plan.athleteDisplayName,
        lastName: "Sport Team",
        dob: new Date(Date.UTC(yob, 5, 15)),
        nationality: "ITA",
        gender: ["LAURA", "ISA"].includes(sheet) ? "F" : "M",
        sport: "tennis",
        discipline: "singles",
        publicSlug: `sportteam-${sheet.toLowerCase()}`,
      },
    });

    const planRow = await prisma.tennisSeasonPlan.create({
      data: {
        academyId: academy.id,
        athleteId,
        season: "2026",
        columns: plan.columns,
      },
    });

    for (const e of plan.entries) {
      if (!e.weekStart) continue;
      const dedupeKey = e.parsedName ? `${e.parsedName.toLowerCase()}|${e.weekStart.toISOString().slice(0,10)}|${e.columnKey}` : "";
      const tournamentId = catalogueIdByKey.get(dedupeKey) ?? null;
      await prisma.tennisSeasonPlanEntry.create({
        data: {
          planId: planRow.id,
          weekStart: e.weekStart,
          trainingPhase: e.trainingPhase,
          columnKey: e.columnKey,
          tournamentId,
          freeText: tournamentId ? null : e.text,
          notes: e.parsedDateRange ? `Range: ${e.parsedDateRange}` : null,
        },
      });
      entryCount++;
    }
    athleteCount++;
    console.log(`  ✓ ${plan.athleteDisplayName.padEnd(12, " ")} ${plan.entries.length} entries`);
  }

  console.log("");
  console.log("✓ Sport Team Padova ready.");
  console.log(`  Athletes:    ${athleteCount}`);
  console.log(`  Tournaments: ${catalogue.length}`);
  console.log(`  Plan entries: ${entryCount}`);
  console.log(`  Sign-in:     ${MAX_EMAIL} / ${pwd}`);
  console.log("");
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });

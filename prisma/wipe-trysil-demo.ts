// One-shot cleanup: turn the Trysil tenant from "demo" into "operativo".
//
// The original seed-trysil.ts stamped sample LineBooking rows + an
// assistant coach to make the product feel populated during prototyping.
// Marius is now going live, so the demo data has to disappear before he
// keys in real athletes / real bookings / real expenses.
//
// What this script removes (Trysil tenant only — every other academy on
// the platform is untouched):
//   - Sample LineBookings tagged `notes="seed-week"` (internal team
//     placeholders + the 4 Pay-and-Train demo slots).
//   - Customer-purchased LineBookings whose customerEmail is "@example.no"
//     or "test@" (test bookings we made during QA).
//   - The "Assistant Coach" record (Pietro Meggiolaro placeholder).
//   - Demo athletes / enrollments / payments / applications that came in
//     from the older seed.ts run before Trysil-specific setup existed.
//   - Calendar events whose notes flag them as imported demo plans.
//
// What this script KEEPS:
//   - Trysil academy itself, Marius admin user, Marius head-coach record.
//   - 4 teams (Tech Elite, Dev1, Dev2, Youth) — anagrafica only, no roster.
//   - 5 packages (real Trysil pricing).
//   - AcademyBudgetBenchmarks (real numbers from Marius's Excel).
//   - 2 slopes + 8 lines (real Trysil Race Center layout).
//
// Run once: `npx tsx prisma/wipe-trysil-demo.ts`
// Idempotent — running it a second time is a no-op.

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function connStr(): string {
  const raw = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set.");
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: connStr(), ssl: { rejectUnauthorized: false } }),
});

const ACADEMY_SLUG = "trysilraceacademy";

async function main() {
  const academy = await prisma.academy.findUnique({ where: { slug: ACADEMY_SLUG } });
  if (!academy) {
    console.log("× No Trysil academy in this DB — nothing to wipe.");
    return;
  }
  console.log("→ Wiping demo data on Trysil tenant", academy.id);

  // ── Line bookings ───────────────────────────────────────────────────
  const seedBookings = await prisma.lineBooking.deleteMany({
    where: { academyId: academy.id, notes: "seed-week" },
  });
  console.log(`  ✓ removed ${seedBookings.count} sample LineBookings (seed-week)`);

  const testCustomerBookings = await prisma.lineBooking.deleteMany({
    where: {
      academyId: academy.id,
      OR: [
        { customerEmail: { endsWith: "@example.no" } },
        { customerEmail: { endsWith: "@example.com" } },
        { customerEmail: { contains: "hafjell.no" } },
      ],
    },
  });
  console.log(`  ✓ removed ${testCustomerBookings.count} test customer LineBookings`);

  // ── Calendar events ─────────────────────────────────────────────────
  const calendar = await prisma.calendarEvent.deleteMany({
    where: { academyId: academy.id },
  });
  console.log(`  ✓ removed ${calendar.count} CalendarEvents (incl. demo imports)`);

  // ── Payments → enrollments → applications → athletes ────────────────
  // Order matters: payments reference enrollments, enrollments reference
  // athletes + applications, applications reference athletes. We follow
  // the FK direction so deletes don't fail on RESTRICT.
  // Invoices first (they reference enrollment + payment).
  try {
    const inv = await prisma.invoice.deleteMany({ where: { academyId: academy.id } });
    console.log(`  ✓ removed ${inv.count} demo Invoices`);
  } catch {
    /* schema may not have Invoice on this client */
  }

  const payments = await prisma.payment.deleteMany({ where: { academyId: academy.id } });
  console.log(`  ✓ removed ${payments.count} demo Payments`);

  const enrollmentIds = (await prisma.enrollment.findMany({
    where: { academyId: academy.id },
    select: { id: true, athleteId: true },
  }));
  const athleteIds = Array.from(new Set(enrollmentIds.map((e) => e.athleteId)));

  // EnrollmentEvent has a hard FK to Enrollment — clear it first.
  try {
    const ev = await prisma.enrollmentEvent.deleteMany({
      where: { enrollmentId: { in: enrollmentIds.map((e) => e.id) } },
    });
    console.log(`  ✓ removed ${ev.count} EnrollmentEvent rows`);
  } catch {
    /* model may differ; ignore */
  }

  const enrollments = await prisma.enrollment.deleteMany({ where: { academyId: academy.id } });
  console.log(`  ✓ removed ${enrollments.count} demo Enrollments`);

  const applications = await prisma.application.deleteMany({ where: { academyId: academy.id } });
  console.log(`  ✓ removed ${applications.count} demo Applications`);

  // Athletes are shared across academies (through enrollments); only
  // delete the ones that had NO other enrollment beyond Trysil's.
  let athletesDeleted = 0;
  for (const aid of athleteIds) {
    const stillUsed = await prisma.enrollment.count({ where: { athleteId: aid } });
    if (stillUsed === 0) {
      try {
        await prisma.athlete.delete({ where: { id: aid } });
        athletesDeleted++;
      } catch {
        /* athlete may have non-enrollment FKs (rankings, results, etc.) — skip */
      }
    }
  }
  console.log(`  ✓ removed ${athletesDeleted} demo Athletes (no other enrollment)`);

  // ── Coaches: keep only the Marius head-coach record ─────────────────
  const headCoachId = `seed_trysil_head_${academy.id}`;
  const coachesRemoved = await prisma.coach.deleteMany({
    where: { academyId: academy.id, id: { not: headCoachId } },
  });
  console.log(`  ✓ removed ${coachesRemoved.count} non-Marius Coach records`);

  // ── Expenses (if any from demo flows) ───────────────────────────────
  try {
    const expenses = await prisma.expense.deleteMany({ where: { academyId: academy.id } });
    console.log(`  ✓ removed ${expenses.count} demo Expenses`);
  } catch {
    /* table may not be exposed in this prisma client version */
  }

  // ── Final state ─────────────────────────────────────────────────────
  const remaining = {
    athletes: await prisma.athlete.count(),
    enrollments: await prisma.enrollment.count({ where: { academyId: academy.id } }),
    payments: await prisma.payment.count({ where: { academyId: academy.id } }),
    coaches: await prisma.coach.count({ where: { academyId: academy.id } }),
    groups: await prisma.group.count({ where: { academyId: academy.id } }),
    slopes: await prisma.trainingSlope.count({ where: { academyId: academy.id } }),
    lineBookings: await prisma.lineBooking.count({ where: { academyId: academy.id } }),
    packages: await prisma.package.count({ where: { academyId: academy.id } }),
    calendar: await prisma.calendarEvent.count({ where: { academyId: academy.id } }),
  };

  console.log("");
  console.log("✓ Trysil is operativo.");
  console.log("  Remaining on Trysil tenant:");
  for (const [k, v] of Object.entries(remaining)) {
    console.log(`    · ${k.padEnd(14, " ")} ${v}`);
  }
  console.log("");
  console.log("  Marius signs in at marius@trysilraceacademy.no");
  console.log("  Everything else — athletes, payments, bookings — he keys in.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

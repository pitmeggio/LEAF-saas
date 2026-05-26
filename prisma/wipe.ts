import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

// Destructive: wipes every tenant + every user from the database.
//
// Use this before running `prisma/seed-trysil.ts` to get a clean slate for
// onboarding the first real academy. After running this you will have an
// EMPTY database — no super-admin, no academies, no athletes.
// `seed-trysil.ts` then provisions the platform owner + Trysil in one go.
//
// SAFETY: requires CONFIRM_WIPE=yes in the environment so a stray run can't
// nuke production by accident.
//
//   CONFIRM_WIPE=yes npx tsx prisma/wipe.ts
//
// FK ordering matters — children deleted before parents. If you add a new
// model that references existing ones, add it ABOVE its parent in the list.

function connectionString(): string {
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
  adapter: new PrismaPg({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } }),
});

async function main() {
  if (process.env.CONFIRM_WIPE !== "yes") {
    console.error("ABORT: set CONFIRM_WIPE=yes to actually wipe the database.");
    console.error("Example:  CONFIRM_WIPE=yes npx tsx prisma/wipe.ts");
    process.exit(1);
  }

  const host = (() => {
    try {
      return new URL(connectionString()).host;
    } catch {
      return "unknown";
    }
  })();
  console.log(`→ Wiping database at ${host}…`);

  // ── Conversational / notifications ──
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notification.deleteMany();

  // ── Coach intelligence ──
  await prisma.coachNoteAttachment.deleteMany();
  await prisma.coachNote.deleteMany();

  // ── Finance ──
  await prisma.expenseEvent.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.revenue.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.academyBudgetBenchmarks.deleteMany();

  // ── Athlete + enrolment lifecycle ──
  await prisma.enrollmentEvent.deleteMany();
  await prisma.document.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.statusEvent.deleteMany();
  await prisma.note.deleteMany();
  await prisma.application.deleteMany();
  await prisma.opportunity.deleteMany();

  // ── Sport-specific profiles ──
  await prisma.tennisMatch.deleteMany();
  await prisma.skiProfile.deleteMany();
  await prisma.tennisProfile.deleteMany();

  // ── Roster + structure ──
  await prisma.group.deleteMany();
  await prisma.coach.deleteMany();
  await prisma.media.deleteMany();
  await prisma.publicAthleteMedia.deleteMany();
  await prisma.result.deleteMany();
  await prisma.rankingPoint.deleteMany();
  await prisma.program.deleteMany();
  await prisma.package.deleteMany();

  // ── Users + athletes + academy requests + academies ──
  await prisma.user.deleteMany();
  await prisma.athlete.deleteMany();
  await prisma.academyRequest.deleteMany();
  await prisma.academy.deleteMany();

  console.log("✓ Database wiped.");
  console.log("");
  console.log("Next:  npx tsx prisma/seed-trysil.ts");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

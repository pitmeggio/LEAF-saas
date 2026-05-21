import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { REQUIRED_DOC_TYPES, buildPaymentSchedule } from "../src/lib/enrollmentLogic.js";

// Seeding prefers DIRECT_URL (Session pooler, 5432) when set, else DATABASE_URL.
function seedConnectionString(): string {
  const raw = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set — see the README 'Simple setup'.");
  try { const u = new URL(raw); u.searchParams.delete("sslmode"); return u.toString(); } catch { return raw; }
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: seedConnectionString(), ssl: { rejectUnauthorized: false } }),
});

type AthleteSeed = {
  firstName: string;
  lastName: string;
  ageYears: number;
  nationality: string;
  gender: "M" | "F";
  discipline: string;
  fisCode: string;
  startPoints: number;
  endPoints: number;
  worldRank: number;
  photoColor: string;
  location: string;
  bio: string;
};

const EVENTS = ["FIS Race", "National Championship", "Europa Cup", "Citadin Race", "Junior World Championship", "NorAm Cup"];
const VENUES = ["Val Gardena, IT", "Hafjell, NO", "Schladming, AT", "Levi, FI", "Adelboden, CH", "Are, SE", "Kranjska Gora, SI"];

const athletes: AthleteSeed[] = [
  { firstName: "Emma", lastName: "Lindqvist", ageYears: 17, nationality: "SE", gender: "F", discipline: "slalom", fisCode: "SWE-505123", startPoints: 38.2, endPoints: 18.6, worldRank: 142, photoColor: "#0ea5e9", location: "Åre, SE", bio: "Slalom specialist, rapid technical progression over the last season." },
  { firstName: "Lukas", lastName: "Brandt", ageYears: 19, nationality: "AT", gender: "M", discipline: "giant_slalom", fisCode: "AUT-512004", startPoints: 25.4, endPoints: 14.1, worldRank: 88, photoColor: "#f59e0b", location: "Schladming, AT", bio: "Strong GS skier with consistent top-15 finishes in Europa Cup." },
  { firstName: "Mathilde", lastName: "Berg", ageYears: 16, nationality: "NO", gender: "F", discipline: "giant_slalom", fisCode: "NOR-530881", startPoints: 52.1, endPoints: 29.3, worldRank: 210, photoColor: "#10b981", location: "Hafjell, NO", bio: "Junior talent, sharp improvement curve, U16 national medalist." },
  { firstName: "Tobias", lastName: "Hansen", ageYears: 18, nationality: "NO", gender: "M", discipline: "slalom", fisCode: "NOR-528417", startPoints: 31.7, endPoints: 22.9, worldRank: 165, photoColor: "#6366f1", location: "Oslo, NO", bio: "Technical slalom skier, steady season, eyeing Europa Cup points." },
  { firstName: "Giulia", lastName: "Rossi", ageYears: 17, nationality: "IT", gender: "F", discipline: "super_g", fisCode: "ITA-541209", startPoints: 44.8, endPoints: 26.0, worldRank: 188, photoColor: "#ec4899", location: "Val Gardena, IT", bio: "Speed-oriented, transitioning from GS to Super-G with good results." },
  { firstName: "Florian", lastName: "Moser", ageYears: 20, nationality: "AT", gender: "M", discipline: "downhill", fisCode: "AUT-509933", startPoints: 19.9, endPoints: 12.7, worldRank: 64, photoColor: "#ef4444", location: "Kitzbühel, AT", bio: "Downhill prospect, top-10 NorAm, strong physical profile." },
  { firstName: "Sofia", lastName: "Kovač", ageYears: 15, nationality: "SI", gender: "F", discipline: "slalom", fisCode: "SLO-552210", startPoints: 78.4, endPoints: 41.2, worldRank: 340, photoColor: "#8b5cf6", location: "Kranjska Gora, SI", bio: "Youngest in the pool, exceptional growth rate, one to watch." },
  { firstName: "Henrik", lastName: "Aas", ageYears: 19, nationality: "NO", gender: "M", discipline: "giant_slalom", fisCode: "NOR-525667", startPoints: 27.3, endPoints: 28.9, worldRank: 151, photoColor: "#14b8a6", location: "Trondheim, NO", bio: "Consistent GS skier, slight decline this season — needs attention." },
  { firstName: "Chiara", lastName: "Bianchi", ageYears: 18, nationality: "IT", gender: "F", discipline: "giant_slalom", fisCode: "ITA-538902", startPoints: 35.6, endPoints: 19.4, worldRank: 137, photoColor: "#f97316", location: "Bormio, IT", bio: "GS specialist, podiums in national circuit, ready for next level." },
  { firstName: "Nils", lastName: "Eriksson", ageYears: 16, nationality: "SE", gender: "M", discipline: "slalom", fisCode: "SWE-548771", startPoints: 61.0, endPoints: 33.5, worldRank: 256, photoColor: "#3b82f6", location: "Östersund, SE", bio: "Junior slalom skier with a strong upward trajectory." },
  { firstName: "Lea", lastName: "Hofer", ageYears: 21, nationality: "AT", gender: "F", discipline: "super_g", fisCode: "AUT-504112", startPoints: 16.8, endPoints: 15.9, worldRank: 71, photoColor: "#d946ef", location: "Innsbruck, AT", bio: "Established speed skier, stable elite-level points." },
  { firstName: "Marco", lastName: "Ferrari", ageYears: 17, nationality: "IT", gender: "M", discipline: "downhill", fisCode: "ITA-545330", startPoints: 49.2, endPoints: 28.7, worldRank: 199, photoColor: "#22c55e", location: "Cortina, IT", bio: "Brave downhill junior, big improvement after summer training block." },
];

const ENROLLED_COUNT = 8; // first N athletes become active members; rest stay applicants

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}
function dobFromAge(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(2, 14);
  return d;
}
function round(n: number, p = 1): number {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

async function main() {
  // Reset (order respects FKs)
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.enrollmentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.statusEvent.deleteMany();
  await prisma.note.deleteMany();
  await prisma.application.deleteMany();
  await prisma.group.deleteMany();
  await prisma.coach.deleteMany();
  await prisma.media.deleteMany();
  await prisma.publicAthleteMedia.deleteMany();
  await prisma.result.deleteMany();
  await prisma.rankingPoint.deleteMany();
  await prisma.program.deleteMany();
  await prisma.package.deleteMany();
  await prisma.user.deleteMany();
  await prisma.athlete.deleteMany();
  await prisma.academy.deleteMany();

  const academy = await prisma.academy.create({
    data: {
      name: "Trysil Race Academy",
      slug: "trysil-race-academy",
      country: "NO",
      location: "Trysil, Norway",
      sport: "ski",
      season: "2026/27",
      tagline: "Where Norway's next alpine racers are made.",
      description:
        "Trysil Race Academy is a full-time alpine ski racing program based at one of Norway's premier training venues. We combine on-snow volume, strength & conditioning, video analysis and FIS-level competition support to develop athletes from U16 through to the national circuit. Small groups, experienced coaches, and a data-driven approach to progression.",
      requirements:
        "Active FIS licence or national federation membership\nMinimum age 14 by start of season\nCommitment to the full 2026/27 race calendar\nBaseline fitness assessment on intake\nReferences from current coach or club",
      logoColor: "#7CFF6B",
      status: "active",
      plan: "PRO",
      // Public recruiting demo
      recruitingEnabled: true,
      recruitingStatus: "LIMITED_SPOTS",
      publicRecruitingHeadline: "Recruiting alpine racers for the 2026/27 season",
      publicRecruitingDescription:
        "We're selecting a small group of committed FIS-level athletes for full-time training at Trysil. We look for athletes with a strong work ethic, a clear development trajectory, and the ambition to race on the national and international circuit. Limited places — early applications are reviewed first.",
      applicationDeadline: new Date("2026-08-15"),
      availableSpots: 6,
      acceptedCountries: "NO, SE, FI, DK, AT, IT",
      ageCategories: "U16, U18, U21",
      rankingRequirement: "Active FIS licence · GS/SL points under 80 preferred (development spots case-by-case)",
      programTypes: "Full Package, Training Only, Race Support",
      featuredAcademy: true,
      contactEmail: "recruiting@trysilrace.no",
      publicApplyEnabled: true,
    },
  });

  // Platform owner — no academyId; reaches the /super-admin portal, not a tenant workspace.
  await prisma.user.create({ data: { name: "Platform Owner", email: "owner@apex.io", role: "super_admin", academyId: null } });

  // Coaches (created before users so coach logins can link to their Coach record)
  const coaches = await Promise.all([
    prisma.coach.create({ data: { academyId: academy.id, name: "Lars Vetting", email: "lars@trysilrace.no", phone: "+47 901 11 222", role: "head_coach", specialization: "Slalom / GS", cost: 38000 } }),
    prisma.coach.create({ data: { academyId: academy.id, name: "Marit Solheim", email: "marit@trysilrace.no", phone: "+47 902 33 444", role: "coach", specialization: "Speed (SG/DH)", cost: 30000 } }),
    prisma.coach.create({ data: { academyId: academy.id, name: "Jonas Holt", email: "jonas@trysilrace.no", phone: "+47 903 55 666", role: "s_and_c", specialization: "Strength & conditioning", cost: 24000 } }),
  ]);

  // Login users: 1 admin + 2 coach logins linked to their Coach records.
  const admin = await prisma.user.create({ data: { academyId: academy.id, name: "Anna Keller", email: "anna@trysilrace.no", role: "academy_admin" } });
  const coachUser = await prisma.user.create({ data: { academyId: academy.id, name: "Lars Vetting", email: "lars@trysilrace.no", role: "coach", coachId: coaches[0].id } });
  const coachUser2 = await prisma.user.create({ data: { academyId: academy.id, name: "Marit Solheim", email: "marit@trysilrace.no", role: "coach", coachId: coaches[1].id } });
  // Map a Coach record to its login user (for conversation assignment).
  const coachUserByCoachId: Record<string, string> = { [coaches[0].id]: coachUser.id, [coaches[1].id]: coachUser2.id };

  const programs = await Promise.all([
    prisma.program.create({ data: { academyId: academy.id, name: "Tech Squad U18", discipline: "slalom", ageMin: 14, ageMax: 18, season: "2026/27" } }),
    prisma.program.create({ data: { academyId: academy.id, name: "GS Development", discipline: "giant_slalom", ageMin: 15, ageMax: 20, season: "2026/27" } }),
    prisma.program.create({ data: { academyId: academy.id, name: "Speed Project", discipline: "super_g", ageMin: 16, ageMax: 22, season: "2026/27" } }),
  ]);

  const packages = await Promise.all([
    prisma.package.create({ data: { academyId: academy.id, name: "Full Season", description: "Complete 2026/27 program — daily training, race support and full athlete services.", price: 14900, currency: "EUR", period: "season", billingFreq: "seasonal", coaching: true, raceSupport: true, transport: true, accommodation: false, maxAthletes: 20, features: "On-snow training (5 days/week)\nStrength & conditioning\nVideo analysis\nRace travel & support\nFIS points tracking", order: 1 } }),
    prisma.package.create({ data: { academyId: academy.id, name: "Winter Camp", description: "Intensive 3-week on-snow block during peak winter conditions.", price: 3200, currency: "EUR", period: "camp", billingFreq: "one_time", coaching: true, accommodation: true, maxAthletes: 15, features: "3 weeks on-snow\nGroup coaching\nVideo analysis\nAccommodation included", order: 2 } }),
    prisma.package.create({ data: { academyId: academy.id, name: "Weekend Program", description: "Part-time weekend training for athletes balancing school and racing.", price: 4900, currency: "EUR", period: "season", billingFreq: "seasonal", coaching: true, maxAthletes: 25, features: "Sat & Sun training\nGroup coaching\nMonthly progress review", order: 3 } }),
    prisma.package.create({ data: { academyId: academy.id, name: "Private Coaching", description: "1:1 coaching blocks, billed monthly.", price: 600, currency: "EUR", period: "month", billingFreq: "monthly", coaching: true, maxAthletes: 10, features: "1:1 coaching\nIndividual video analysis\nFlexible scheduling", order: 4 } }),
  ]);

  // Groups (one intentionally small to demo over-capacity automation)
  const groups = await Promise.all([
    prisma.group.create({ data: { academyId: academy.id, name: "Development Team", sport: "ski", season: "2026/27", coachId: coaches[0].id, capacity: 10, budget: 40000 } }),
    prisma.group.create({ data: { academyId: academy.id, name: "Speed Project Team", sport: "ski", season: "2026/27", coachId: coaches[1].id, capacity: 2, budget: 28000 } }),
    prisma.group.create({ data: { academyId: academy.id, name: "Tech Team", sport: "ski", season: "2026/27", coachId: coaches[0].id, capacity: 12, budget: 35000 } }),
  ]);

  // Sample coach expenses (drives the expenses module + group budget usage)
  await Promise.all([
    prisma.expense.create({ data: { academyId: academy.id, coachId: coaches[0].id, groupId: groups[0].id, title: "Race weekend travel — Hafjell", amount: 1200, category: "travel", status: "approved" } }),
    prisma.expense.create({ data: { academyId: academy.id, coachId: coaches[0].id, groupId: groups[0].id, title: "Timing equipment", amount: 450, category: "equipment", status: "submitted" } }),
    prisma.expense.create({ data: { academyId: academy.id, coachId: coaches[0].id, groupId: groups[2].id, title: "Camp accommodation deposit", amount: 800, category: "accommodation", status: "reimbursed" } }),
    prisma.expense.create({ data: { academyId: academy.id, coachId: coaches[1].id, groupId: groups[1].id, title: "Speed camp transport", amount: 900, category: "travel", status: "approved" } }),
    prisma.expense.create({ data: { academyId: academy.id, coachId: coaches[1].id, groupId: groups[1].id, title: "Gate panels", amount: 600, category: "equipment", status: "draft" } }),
  ]);

  const LEVELS = ["development", "competitive", "elite"];
  const applicantStatuses = ["new", "reviewing", "shortlisted", "rejected"];
  let invoiceCounter = 0;

  for (let i = 0; i < athletes.length; i++) {
    const a = athletes[i];
    const enrolled = i < ENROLLED_COUNT;
    const minor = a.ageYears < 18;

    const athlete = await prisma.athlete.create({
      data: {
        firstName: a.firstName,
        lastName: a.lastName,
        dob: dobFromAge(a.ageYears),
        nationality: a.nationality,
        gender: a.gender,
        discipline: a.discipline,
        fisCode: a.fisCode,
        fisPoints: a.endPoints,
        worldRank: a.worldRank,
        photoColor: a.photoColor,
        location: a.location,
        bio: a.bio,
        verified: true,
        email: `${a.firstName.toLowerCase()}.${a.lastName.toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
        phone: enrolled ? "+47 4" + (100000 + i * 7919).toString().slice(0, 7) : null,
        emergencyContact: enrolled ? `${minor ? "Parent" : "Partner"} · +47 4${(200000 + i * 5101).toString().slice(0, 7)}` : null,
        guardianName: minor ? `${a.lastName} (guardian)` : null,
        guardianContact: minor ? `guardian.${a.lastName.toLowerCase().replace(/[^a-z]/g, "")}@example.com` : null,
        injuryFlag: enrolled && i === 3,
        // Demo public recruiting profile on the first enrolled athlete.
        ...(i === 0
          ? {
              publicProfileEnabled: true,
              publicSlug: `${a.firstName}-${a.lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              publicVisibility: "PUBLIC",
              publicVerified: true,
              publicBio: `${a.bio} Open to recruiting conversations for the 2026/27 season.`,
              publicShowAcademy: true,
              publicShowRanking: true,
              publicShowResults: true,
              publicShowMedia: true,
              publicShowExternalProfiles: true,
              publicContactEnabled: true,
              fisProfileUrl: `https://www.fis-ski.com/DB/general/athlete-biography.html?sectorcode=AL&competitorid=${a.fisCode}`,
            }
          : {}),
      },
    });

    // Demo public media (only the first athlete; isApprovedPublic gates visibility).
    if (i === 0) {
      await prisma.publicAthleteMedia.createMany({
        data: [
          { athleteId: athlete.id, type: "VIDEO", title: "2026 season highlights", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", thumbnailUrl: null, isApprovedPublic: true, sortOrder: 0 },
          { athleteId: athlete.id, type: "IMAGE", title: "Race day — Val Gardena", url: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256", thumbnailUrl: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600", isApprovedPublic: true, sortOrder: 1 },
          { athleteId: athlete.id, type: "PDF", title: "Athlete CV (2026)", url: "https://example.com/cv.pdf", thumbnailUrl: null, isApprovedPublic: true, sortOrder: 2 },
          { athleteId: athlete.id, type: "LINK", title: "Unapproved draft (hidden)", url: "https://example.com/draft", thumbnailUrl: null, isApprovedPublic: false, sortOrder: 3 },
        ],
      });
    }

    // 13 monthly FIS-points snapshots interpolated start -> end
    const span = 12;
    for (let m = 0; m <= span; m++) {
      const t = m / span;
      const base = a.startPoints + (a.endPoints - a.startPoints) * t;
      const noise = (Math.sin(i * 3 + m) + 0.5) * 1.2;
      const pts = Math.max(5, round(base + noise, 2));
      const rank = Math.round(a.worldRank * (1 + (1 - t) * 1.4));
      await prisma.rankingPoint.create({ data: { athleteId: athlete.id, date: monthsAgo(span - m), fisPoints: pts, worldRank: rank } });
    }

    for (let r = 0; r < 5; r++) {
      const pts = round(a.endPoints + (Math.random() * 8 - 2), 2);
      await prisma.result.create({ data: { athleteId: athlete.id, date: monthsAgo(r * 2 + 1), eventName: EVENTS[(i + r) % EVENTS.length], location: VENUES[(i + r) % VENUES.length], discipline: a.discipline, rank: 1 + ((i + r * 3) % 25), fisPoints: Math.max(5, pts) } });
    }

    await prisma.media.create({ data: { athleteId: athlete.id, type: "video", title: "Season highlights", duration: "2:14" } });

    const program = programs.find((p) => p.discipline === a.discipline) ?? programs[0];
    const trendDelta = a.startPoints - a.endPoints;
    const score = Math.max(20, Math.min(99, Math.round(40 + trendDelta * 0.7 + (22 - a.ageYears) * 1.5)));
    const pkg = packages[i % 3]; // applicants get a preferred package too

    const status = enrolled ? "accepted" : applicantStatuses[(i - ENROLLED_COUNT) % applicantStatuses.length];
    // One applicant has been waiting a long time (alert demo)
    const waitingLong = !enrolled && i === ENROLLED_COUNT;
    const submittedAt = waitingLong ? monthsAgo(2) : monthsAgo(0);

    const app = await prisma.application.create({
      data: {
        academyId: academy.id,
        athleteId: athlete.id,
        programId: program.id,
        packageId: pkg.id,
        status,
        score,
        source: i % 3 === 0 ? "marketplace" : "public_form",
        sport: "ski",
        message: `I'd love to join ${program.name} for the 2026/27 season. ${a.bio}`,
        submittedAt,
      },
    });
    await prisma.statusEvent.create({ data: { applicationId: app.id, from: null, to: "new", createdAt: monthsAgo(2) } });
    if (status !== "new") await prisma.statusEvent.create({ data: { applicationId: app.id, from: "new", to: "reviewing", createdAt: monthsAgo(1) } });
    if (["shortlisted", "accepted", "rejected"].includes(status)) await prisma.statusEvent.create({ data: { applicationId: app.id, from: "reviewing", to: status, createdAt: monthsAgo(0) } });

    if (i % 2 === 0) {
      await prisma.note.create({ data: { applicationId: app.id, authorId: coachUser.id, body: `Strong profile. Trend ${trendDelta > 0 ? "improving" : "needs review"} (${round(Math.abs(trendDelta))} FIS pts). Worth a call.` } });
    }

    // Every application gets a conversation thread; some have a sample exchange.
    const fullName = `${a.firstName} ${a.lastName}`;
    const conversation = await prisma.conversation.create({
      data: {
        academyId: academy.id,
        type: "application",
        applicationId: app.id,
        athleteId: athlete.id,
        subject: `${fullName} — application`,
        status: i % 3 === 0 ? "waiting" : "open",
        lastMessageAt: monthsAgo(1),
        lastMessagePreview: "Application received. Welcome!",
      },
    });
    await prisma.message.create({ data: { conversationId: conversation.id, senderSide: "system", senderRole: "system", senderName: "System", body: `Application received for ${program.name}. A coach will review it shortly.`, createdAt: monthsAgo(2) } });
    if (i % 3 === 0) {
      // Applicant asked something and is waiting for a reply (drives unread + "waiting").
      await prisma.message.create({ data: { conversationId: conversation.id, senderSide: "external", senderRole: minor ? "parent" : "applicant", senderName: minor ? `${a.lastName} (guardian)` : fullName, body: "Hi! When does the season start, and what equipment should we bring?", createdAt: monthsAgo(1) } });
    } else if (i % 3 === 1) {
      await prisma.message.create({ data: { conversationId: conversation.id, senderSide: "staff", senderRole: "coach", senderName: coachUser.name, senderUserId: coachUser.id, body: "Thanks for applying — your profile looks strong. We'll be in touch about next steps.", createdAt: monthsAgo(1) } });
    }

    if (!enrolled) continue;

    // ── Active athlete (enrollment) automation ──────────────────────────────
    const joinDate = monthsAgo(4);
    const group = groups[i % 3];
    const enrollStatus = i === 3 ? "injured" : i === 5 ? "paused" : "active";

    const enrollment = await prisma.enrollment.create({
      data: {
        academyId: academy.id,
        athleteId: athlete.id,
        applicationId: app.id,
        packageId: pkg.id,
        coachId: group.coachId,
        groupId: group.id,
        level: LEVELS[i % 3],
        status: enrollStatus,
        joinDate,
      },
    });
    await prisma.enrollmentEvent.create({ data: { enrollmentId: enrollment.id, type: "created", to: "active", detail: "Active athlete created from accepted application", createdAt: joinDate } });
    // Connect the existing application thread to the enrollment (history follows the athlete).
    await prisma.conversation.update({ where: { id: conversation.id }, data: { enrollmentId: enrollment.id, type: "athlete", assignedToUserId: group.coachId ? coachUserByCoachId[group.coachId] ?? null : null } });

    // Payment schedule from package, then vary paid/unpaid for realistic finance data
    const schedule = buildPaymentSchedule({ price: pkg.price, currency: pkg.currency, billingFreq: pkg.billingFreq, joinDate });
    schedule.forEach(() => {});
    for (let s = 0; s < schedule.length; s++) {
      const p = schedule[s];
      // i%3: 0 → all paid except last; 1 → first paid (rest overdue/unpaid); 2 → none paid
      let paid = false;
      if (i % 3 === 0) paid = s < schedule.length - 1;
      else if (i % 3 === 1) paid = s === 0;
      else paid = false;
      // One athlete (i===4) demonstrates a partial payment on the first installment.
      const partial = !paid && i === 4 && s === 0;
      const paidAmount = paid ? p.amount : partial ? Math.round(p.amount * 0.4) : 0;
      const payment = await prisma.payment.create({
        data: {
          academyId: academy.id,
          enrollmentId: enrollment.id,
          label: p.label,
          amount: p.amount,
          paidAmount,
          currency: p.currency,
          dueDate: p.dueDate,
          paidDate: paid ? p.dueDate : null,
          status: paid ? "paid" : partial ? "partial" : "unpaid",
          method: paid ? "bank_transfer" : null,
        },
      });
      // Every payment gets an invoice (created with the schedule). Pending until paid;
      // overdue is derived from the due date at read time.
      invoiceCounter++;
      await prisma.invoice.create({
        data: {
          academyId: academy.id,
          enrollmentId: enrollment.id,
          paymentId: payment.id,
          number: `INV-2627-${String(invoiceCounter).padStart(4, "0")}`,
          amount: p.amount,
          currency: p.currency,
          status: paid ? "paid" : partial ? "partial" : "pending",
          issuedAt: joinDate,
          paidAt: paid ? p.dueDate : null,
        },
      });
    }

    // Required documents with varied status (drives missing/expired alerts)
    for (let d = 0; d < REQUIRED_DOC_TYPES.length; d++) {
      const type = REQUIRED_DOC_TYPES[d];
      let docStatus = "uploaded";
      let expiresAt: Date | null = null;
      if (type === "medical_certificate") {
        if (i % 4 === 0) { docStatus = "expired"; expiresAt = monthsAgo(1); }
        else { docStatus = "verified"; expiresAt = monthsAgo(-10); }
      } else if (type === "academy_contract") {
        docStatus = i % 2 === 0 ? "verified" : "uploaded";
      } else if (type === "race_license") {
        docStatus = i % 3 === 0 ? "missing" : "uploaded";
      }
      await prisma.document.create({
        data: {
          academyId: academy.id,
          enrollmentId: enrollment.id,
          type,
          status: docStatus,
          required: true,
          expiresAt,
          fileUrl: docStatus === "missing" ? null : "https://example.com/doc.pdf",
        },
      });
    }
  }

  console.log(`Seeded: 1 academy, ${athletes.length} athletes (${ENROLLED_COUNT} active), ${coaches.length} coaches, ${packages.length} packages, ${groups.length} groups.`);
  console.log(`Users: ${admin.name} (admin), ${coachUser.name} (coach).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

// One-off, idempotent: set Smart Group Assignment rules on existing demo groups
// by name (so the recommender is demonstrable without a full reseed).
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

function conn(): string {
  const raw = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set.");
  try { const u = new URL(raw); u.searchParams.delete("sslmode"); return u.toString(); } catch { return raw; }
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conn(), ssl: { rejectUnauthorized: false } }) });

const RULES: Record<string, { pointsMin: number; pointsMax: number; ageMin: number; ageMax: number; level: string; discipline?: string }> = {
  "Tech Team": { pointsMin: 18, pointsMax: 34, ageMin: 14, ageMax: 19, level: "competitive" },
  "Development Team": { pointsMin: 38, pointsMax: 62, ageMin: 14, ageMax: 21, level: "development" },
  "Speed Project Team": { pointsMin: 8, pointsMax: 45, ageMin: 16, ageMax: 23, level: "elite", discipline: "super_g" },
};

async function main() {
  let n = 0;
  for (const [name, rule] of Object.entries(RULES)) {
    const res = await prisma.group.updateMany({ where: { name }, data: rule });
    n += res.count;
  }
  console.log(`Applied group rules to ${n} group(s).`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

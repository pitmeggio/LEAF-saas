// One-off, idempotent backfill: give every credential-less user a known demo
// password so the real email/password sign-in works without wiping any data.
// Usage: DEMO_PASSWORD=leaf2026 tsx prisma/set-demo-passwords.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

function connectionString(): string {
  const raw = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set.");
  try { const u = new URL(raw); u.searchParams.delete("sslmode"); return u.toString(); } catch { return raw; }
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } }),
});

const PASSWORD = process.env.DEMO_PASSWORD || "leaf2026";

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const res = await prisma.user.updateMany({ where: { passwordHash: null }, data: { passwordHash: hash } });
  console.log(`Set demo password "${PASSWORD}" on ${res.count} user(s) without a credential.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

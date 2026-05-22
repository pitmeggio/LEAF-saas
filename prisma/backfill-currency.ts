import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { currencyForCountry } from "../src/lib/currency.js";

function conn(): string {
  const raw = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set.");
  try { const u = new URL(raw); u.searchParams.delete("sslmode"); return u.toString(); } catch { return raw; }
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conn(), ssl: { rejectUnauthorized: false } }) });

// One-off: set each academy's currency from its country (ISO-2 → ISO-4217).
async function main() {
  const academies = await prisma.academy.findMany({ select: { id: true, name: true, country: true, currency: true } });
  for (const a of academies) {
    const want = currencyForCountry(a.country);
    if (want !== a.currency) {
      await prisma.academy.update({ where: { id: a.id }, data: { currency: want } });
      console.log(`${a.name} (${a.country}): ${a.currency} → ${want}`);
    } else {
      console.log(`${a.name} (${a.country}): ${a.currency} (unchanged)`);
    }
  }
}
main().finally(() => prisma.$disconnect());

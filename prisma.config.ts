import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

// Migrations / `prisma db push` prefer DIRECT_URL (Supabase Session pooler, 5432) when
// set, because schema changes need advisory locks the transaction pooler can't hold.
// Falls back to DATABASE_URL. We strip `sslmode` and set TLS explicitly below so any
// string copied from Supabase works as-is.
function getConnectionString(): string {
  const raw = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set — see the README 'Simple setup'.");
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

const connectionString = getConnectionString();

// Hoisted to a variable so TS skips excess-property checking on the object literal:
// `adapter` is honoured by the Prisma config loader at runtime but isn't on the
// exported PrismaConfig type in 7.8, which would otherwise fail `next build`.
const config = {
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: connectionString,
  },
  adapter: () => new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } }),
};

export default defineConfig(config);

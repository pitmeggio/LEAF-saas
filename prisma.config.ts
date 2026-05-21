import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

// Single connection string: DATABASE_URL (Supabase Session pooler recommended — it
// works for both app queries and `prisma db push`). We strip `sslmode` and set TLS
// explicitly below so any string copied from Supabase works as-is.
function getConnectionString(): string {
  const raw = process.env.DATABASE_URL;
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

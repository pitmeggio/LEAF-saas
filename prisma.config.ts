import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

// Postgres (Supabase). Two connection strings:
//   DATABASE_URL — transaction pooler (port 6543), used by the app at runtime (serverless-safe).
//   DIRECT_URL   — direct connection (port 5432), used here for migrations (pgBouncer can't
//                  run migration DDL/prepared statements). Falls back to DATABASE_URL if unset.
// Hoisted to a variable so TS skips excess-property checking on the object literal:
// `adapter` is honoured by the Prisma config loader at runtime but isn't on the
// exported PrismaConfig type in 7.8, which would otherwise fail `next build`.
const migrationUrl = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]!;
const config = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
  adapter: () => new PrismaPg({ connectionString: migrationUrl, ssl: { rejectUnauthorized: false } }),
};

export default defineConfig(config);

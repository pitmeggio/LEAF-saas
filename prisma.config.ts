import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// LOCAL DEV uses SQLite for speed. To move to Supabase/Postgres for production:
//   1. schema.prisma: datasource provider "sqlite" -> "postgresql"
//   2. swap the adapter below for @prisma/adapter-pg (PrismaPg)
//   3. set DATABASE_URL to the Supabase connection string
//   4. run `npm run db:migrate` to apply the existing migration history
// The schema uses no SQLite-only features, so the migrations port cleanly.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
  },
  adapter: () => new PrismaBetterSqlite3({ url: process.env["DATABASE_URL"]! }),
});

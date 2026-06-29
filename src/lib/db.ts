import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Resolve the Postgres connection string from the single DATABASE_URL env var.
// We strip `sslmode` from the URL because we set TLS explicitly below — leaving
// `sslmode=require` in the string makes node-postgres re-enable strict cert
// verification, which fails on Supabase's pooler ("self-signed certificate in chain").
function getConnectionString(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and paste your Supabase " +
        "connection string (Supabase → Connect → Session pooler). See the README 'Simple setup'.",
    );
  }
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // ssl.rejectUnauthorized=false: Supabase's pooler presents a cert chain Node
    // doesn't trust by default; the connection is still TLS-encrypted.
    // max + idleTimeoutMillis: Supabase's session pooler caps total clients
    // (pool_size 15). Keep each app instance's pg pool small and let idle
    // connections drain fast so a dev restart (or a second instance) can't
    // exhaust the shared limit and 404/500 every data route.
    adapter: new PrismaPg({
      connectionString: getConnectionString(),
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000,
    }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

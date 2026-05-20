import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Runtime uses the pooled DATABASE_URL (Supabase transaction pooler, serverless-safe).
// ssl.rejectUnauthorized=false: the Supabase pooler presents a cert chain Node doesn't
// trust by default; the connection is still TLS-encrypted. Harden later with the CA cert.
const connectionString = process.env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

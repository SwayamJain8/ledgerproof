import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 retired the Rust query engine, so a driver adapter is mandatory.
 * We hand it `pg` directly, which also means the connection pool is ours to
 * reason about.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Scripts must `import \"dotenv/config\"` first.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

// Next.js dev hot-reloads modules, which would otherwise open a new pool on
// every save until Postgres refuses connections.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * The transaction handle every accounting service takes.
 *
 * Services accept a `Tx` rather than reaching for the global client, so that
 * posting a document, allocating its sequence number and updating the source
 * document are all one atomic unit. If any step throws, no number is burned
 * and no half-entry survives.
 */
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

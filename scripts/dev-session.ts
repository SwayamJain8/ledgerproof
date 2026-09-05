import "dotenv/config";
import { createHmac } from "node:crypto";

import { prisma } from "../src/lib/db";

/**
 * Mint a valid session cookie from the command line.
 *
 * Used to smoke-test authenticated pages with curl during development, since a
 * Server Action cannot easily be driven from a shell. Signs with the same
 * HMAC-SHA256 scheme as src/lib/auth/session.ts.
 *
 *   npx tsx scripts/dev-session.ts [loginId]
 */
const b64url = (input: Buffer) =>
  input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function main() {
  const loginId = process.argv[2] ?? "adminuf";
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");

  const user = await prisma.user.findFirstOrThrow({ where: { loginId } });
  const payload = {
    userId: user.id,
    name: user.name,
    loginId: user.loginId,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 43200,
  };

  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const signature = b64url(createHmac("sha256", secret).update(body).digest());
  console.log(`${body}.${signature}`);
}

main().finally(() => prisma.$disconnect());

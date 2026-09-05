import "dotenv/config";
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

import { prisma } from "../src/lib/db";

/**
 * Screenshot the app for design review.
 *
 *   npx tsx scripts/shots.ts [path ...]
 *
 * Uses the locally installed Edge/Chrome rather than a downloaded Chromium,
 * and mints its own session cookie so authenticated pages render.
 */
const BASE = "http://localhost:3000";
const OUT = "shots";

const b64url = (input: Buffer) =>
  input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function token() {
  const user = await prisma.user.findFirstOrThrow({ where: { loginId: "adminuf" } });
  const body = b64url(
    Buffer.from(
      JSON.stringify({
        userId: user.id,
        name: user.name,
        loginId: user.loginId,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 43200,
      }),
    ),
  );
  const sig = b64url(createHmac("sha256", process.env.SESSION_SECRET!).update(body).digest());
  return `${body}.${sig}`;
}

async function main() {
  const paths = process.argv.slice(2);
  if (paths.length === 0) throw new Error("Pass at least one path, e.g. /accounts");

  mkdirSync(OUT, { recursive: true });

  let browser;
  for (const channel of ["msedge", "chrome"]) {
    try {
      browser = await chromium.launch({ channel });
      break;
    } catch {
      /* try the next one */
    }
  }
  if (!browser) throw new Error("Neither Edge nor Chrome could be launched.");

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  await context.addCookies([
    { name: "uf_session", value: await token(), domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();
  for (const path of paths) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(700);
    const file = `${OUT}/${(path === "/" ? "dashboard" : path.replace(/^\//, "").replace(/[/?=&]/g, "-"))}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }

  await browser.close();
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

import { prisma } from "../src/lib/db";

/**
 * The demo, driven end to end through the real UI.
 *
 *   sign in -> draft a bill -> confirm it -> pay part of it -> re-check the books
 *
 * This is the only test that exercises the Server Actions, the posting engine,
 * the database triggers and the reports together. If it passes, the flow a
 * judge will click through works.
 */
const BASE = "http://localhost:3000";

async function launch() {
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel });
    } catch {
      /* next */
    }
  }
  throw new Error("Neither Edge nor Chrome could be launched.");
}

const step = (n: number, text: string) => console.log(`\n[${n}] ${text}`);
const ok = (text: string) => console.log(`     ok   ${text}`);

async function shot(page: Page, name: string) {
  mkdirSync("shots", { recursive: true });
  await page.screenshot({ path: `shots/e2e-${name}.png`, fullPage: true });
}

async function main() {
  const browser = await launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  const before = await prisma.journalItem.count({ where: { state: "POSTED" } });

  step(1, "Sign in through the form");
  await page.goto(`${BASE}/sign-in`);
  await page.fill("#loginId", "adminuf");
  await page.fill("#password", "Admin@2026x");
  await shot(page, "01-sign-in");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  ok("landed on the dashboard");

  step(2, "Draft a new vendor bill");
  await page.goto(`${BASE}/bills/new`);
  await page.selectOption('select[name="vendorId"]', { label: "Open Wood" });
  await page.fill("#billReference", "E2E-TEST-001");
  await page.selectOption('select[aria-label="Product"]', { label: "Office Chair" });
  await page.fill('input[aria-label="Quantity"]', "10");
  await page.fill('input[aria-label="Unit price"]', "1200.00");
  await page.selectOption('select[aria-label="Analytic account"]', { index: 1 });
  await shot(page, "02-bill-draft");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/bills\/[a-z0-9]+$/, { timeout: 30_000 });
  const billUrl = page.url();
  ok(`draft saved at ${billUrl.replace(BASE, "")}`);

  // A draft must not have touched the ledger.
  const midway = await prisma.journalItem.count({ where: { state: "POSTED" } });
  if (midway !== before) throw new Error("A draft bill wrote to the ledger. It must not.");
  ok("the draft posted nothing to the ledger");

  step(3, "Confirm it");
  await page.click('button:has-text("Confirm")');
  await page.waitForTimeout(2500);
  const heading = (await page.locator("h1").first().textContent())?.trim();
  if (!heading?.startsWith("BILL/")) throw new Error(`Expected a BILL/ number, got "${heading}"`);
  ok(`posted as ${heading}`);
  await shot(page, "03-bill-posted");

  const billId = billUrl.split("/").pop()!;
  const posted = await prisma.vendorBill.findUniqueOrThrow({ where: { id: billId } });
  const entry = await prisma.journalEntry.findFirstOrThrow({
    where: { sourceType: "VENDOR_BILL", sourceId: billId },
    include: { items: { include: { account: true } } },
  });
  if (entry.totalDebitPaise !== entry.totalCreditPaise) throw new Error("Entry does not balance.");
  ok(`entry ${entry.name} balances at ${entry.totalDebitPaise} paise across ${entry.items.length} lines`);
  for (const item of entry.items) {
    const side = item.debitPaise > 0n ? `Dr ${item.debitPaise}` : `Cr ${item.creditPaise}`;
    console.log(`          ${item.account.code} ${item.account.name.padEnd(22)} ${side}`);
  }

  step(4, "Register a partial payment");
  // Two controls carry this label: the one that opens the form, and the one
  // that submits it. Scope the second to the form so the selector stays exact.
  await page.click('button:has-text("Register payment")');
  await page.fill("#amount", "5000.00");
  await page.selectOption("#method", "CASH");
  await shot(page, "04-register-payment");
  await page.click('form button[type="submit"]:has-text("Register payment")');
  await page.waitForTimeout(3000);

  const afterPayment = await prisma.vendorBill.findUniqueOrThrow({ where: { id: billId } });
  const expected = posted.totalPaise - 500_000n;
  if (afterPayment.residualPaise !== expected) {
    throw new Error(`Residual is ${afterPayment.residualPaise}, expected ${expected}.`);
  }
  if (afterPayment.paymentState !== "PARTIAL") {
    throw new Error(`Badge is ${afterPayment.paymentState}, expected PARTIAL.`);
  }
  ok(`residual fell to ${afterPayment.residualPaise} paise and the badge reads PARTIAL`);
  await shot(page, "05-bill-partial");

  step(5, "Re-check the books");
  await page.goto(`${BASE}/reports/integrity`);
  await page.waitForTimeout(1200);
  const verdict = (await page.locator("h1 + *, .font-display").first().textContent()) ?? "";
  const failed = await page.locator("text=/checks failed/").count();
  if (failed > 0) throw new Error("The integrity report shows failures after the E2E run.");
  ok("every integrity check still passes");
  await shot(page, "06-integrity");
  void verdict;

  const after = await prisma.journalItem.count({ where: { state: "POSTED" } });
  console.log(`\nLedger grew from ${before} to ${after} posted items.`);
  console.log("E2E passed: draft -> confirm -> partial payment -> books still tie.\n");

  await browser.close();
}

main()
  .catch((error) => {
    console.error(`\nE2E FAILED: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * EMPTY SEED — a configured but untraded business.
 *
 * Clears everything, then puts back only what the problem statement says is
 * pre-configured, in its own words: "All this accounts are to be pre configured",
 * plus the four journals its Journals list ships with, one tax, the company
 * settings the engine needs, and two logins.
 *
 * What it deliberately does NOT create: contacts, products, categories,
 * analytic accounts, budgets, or a single transaction. You enter those through
 * the UI, which is the point — see WALKTHROUGH.md.
 *
 *   npm run seed:empty     start from nothing
 *   npm run seed           the full ten-entry demo story
 */
import "dotenv/config";
import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/db";

const GST_RATE_BP = 1800;

/**
 * The eight accounts the mockup mandates, plus seven the engine cannot work
 * without. Kept identical to prisma/seed.ts on purpose: if the two ever drift,
 * a demo that starts empty and a demo that starts seeded stop behaving alike.
 */
const ACCOUNTS = [
  { code: "1100", name: "Bank A/c", type: "BANK", subtype: "NONE" },
  { code: "1200", name: "Cash A/c", type: "CASH", subtype: "NONE" },
  { code: "1300", name: "Debtors A/c", type: "ASSET", subtype: "RECEIVABLE", reconcilable: true },
  { code: "1400", name: "Input GST A/c", type: "ASSET", subtype: "TAX_PAID" },
  { code: "1500", name: "Inventory A/c", type: "ASSET", subtype: "INVENTORY" },
  { code: "2100", name: "Creditors A/c", type: "LIABILITY", subtype: "PAYABLE", reconcilable: true },
  { code: "2200", name: "Output GST A/c", type: "LIABILITY", subtype: "TAX_COLLECTED" },
  { code: "3100", name: "Capital A/c", type: "CAPITAL", subtype: "NONE" },
  { code: "3200", name: "Retained Earnings A/c", type: "CAPITAL", subtype: "RETAINED_EARNINGS" },
  { code: "3300", name: "Current Year Earnings", type: "CAPITAL", subtype: "CURRENT_YEAR_EARNINGS" },
  { code: "4100", name: "Sales Income A/c", type: "INCOME", subtype: "NONE" },
  { code: "5100", name: "Purchase Expense A/c", type: "EXPENSE", subtype: "NONE" },
  { code: "5200", name: "Cost of Goods Sold A/c", type: "EXPENSE", subtype: "COGS" },
  { code: "6100", name: "Other Expense A/c", type: "OTHER_EXPENSE", subtype: "NONE" },
  { code: "6900", name: "Rounding Difference A/c", type: "OTHER_EXPENSE", subtype: "ROUNDING" },
] as const;

/** TRUNCATE, not DELETE: row triggers do not fire on TRUNCATE, which is the
 *  only sanctioned way to clear posted ledger rows. */
async function reset() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_log, bank_statement_line, stock_move,
      payment_allocation, payment,
      customer_invoice_line, customer_invoice, sales_order_line, sales_order,
      vendor_bill_line, vendor_bill, purchase_order_line, purchase_order,
      budget_line, budget, analytic_account,
      journal_item, journal_entry, journal, sequence,
      product, product_category, tax,
      "user", contact, account, company_settings
    RESTART IDENTITY CASCADE
  `);
}

async function main() {
  console.log("Clearing everything...");
  await reset();

  console.log("Restoring the pre-configured setup...");

  for (const a of ACCOUNTS) {
    await prisma.account.create({
      data: {
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        reconcilable: "reconcilable" in a ? Boolean(a.reconcilable) : false,
      },
    });
  }
  const accounts = await prisma.account.findMany();
  const id = (code: string) => accounts.find((a) => a.code === code)!.id;

  await prisma.journal.createMany({
    data: [
      { code: "SAL", name: "Sales", type: "SALES", defaultAccountId: id("4100"), sequencePrefix: "INV" },
      { code: "PUR", name: "Purchase", type: "PURCHASE", defaultAccountId: id("5100"), sequencePrefix: "BILL" },
      { code: "BNK", name: "Bank", type: "BANK", defaultAccountId: id("1100"), sequencePrefix: "BNK" },
      { code: "CSH", name: "Cash", type: "CASH", defaultAccountId: id("1200"), sequencePrefix: "CSH" },
    ],
  });

  await prisma.tax.create({
    data: {
      name: "GST 18%",
      rateBp: GST_RATE_BP,
      scope: "BOTH",
      computation: "EXCLUSIVE",
      collectedAccountId: id("2200"),
      paidAccountId: id("1400"),
    },
  });

  await prisma.companySettings.create({
    data: {
      id: 1,
      name: "Urban Furniture",
      currency: "INR",
      fiscalYearStartMonth: 4,
      retainedEarningsAccountId: id("3200"),
      currentYearEarningsAccountId: id("3300"),
      roundingAccountId: id("6900"),
      defaultReceivableAccountId: id("1300"),
      defaultPayableAccountId: id("2100"),
      defaultTaxCollectedAccountId: id("2200"),
      defaultTaxPaidAccountId: id("1400"),
    },
  });

  // Document numbering has to exist before the first document is posted.
  await prisma.sequence.createMany({
    data: [
      { code: "customer_invoice", prefix: "INV/", fiscalYear: 2026, padding: 4, useYear: true },
      { code: "vendor_bill", prefix: "BILL/", fiscalYear: 2026, padding: 4, useYear: true },
      { code: "payment", prefix: "PAY/", fiscalYear: 2026, padding: 4, useYear: true },
      { code: "manual_entry", prefix: "JE/", fiscalYear: 2026, padding: 4, useYear: true },
      { code: "purchase_order", prefix: "PO", fiscalYear: 2026, padding: 4, useYear: false },
      { code: "sales_order", prefix: "SO", fiscalYear: 2026, padding: 4, useYear: false },
    ],
  });

  const hash = (plain: string) => bcrypt.hashSync(plain, 10);
  await prisma.user.createMany({
    data: [
      { name: "Admin", loginId: "adminuf", email: "admin@urbanfurniture.in", passwordHash: hash("Admin@2026x"), role: "ADMIN" },
      { name: "Priya Accountant", loginId: "priyaacc", email: "priya@urbanfurniture.in", passwordHash: hash("Priya@2026x"), role: "ACCOUNTANT" },
    ],
  });

  console.log("");
  console.log("  15 accounts, 4 journals, 1 tax, 2 logins.");
  console.log("  0 contacts, 0 products, 0 transactions.");
  console.log("");
  console.log("  Sign in as adminuf / Admin@2026x and follow WALKTHROUGH.md");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

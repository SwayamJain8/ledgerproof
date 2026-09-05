import "dotenv/config";
import bcrypt from "bcryptjs";

import { prisma, type Tx } from "../src/lib/db";
import { accountingDate } from "../src/lib/accounting/dates";
import { lineSubtotalPaise, rupeesToPaise, qtyToMilli, formatINR } from "../src/lib/money";
import { documentTotals, confirmCustomerInvoice, confirmVendorBill, confirmPayment } from "../src/lib/accounting/documents";
import { postManualLines } from "../src/lib/accounting/posting";
import { allocateDocumentNumber, SEQUENCE_CODES } from "../src/lib/accounting/sequence";
import {
  confirmPurchaseOrder,
  confirmSalesOrder,
  createBillFromPurchaseOrder,
  createInvoiceFromSalesOrder,
} from "../src/lib/accounting/orders";

/**
 * SEED — Urban Furniture's first four months, 01-Apr-2026 to 31-Jul-2026.
 *
 * DELIBERATELY SMALL. Ten journal entries, three invoices, two bills, three
 * payments. Small enough to hold in your head and narrate line by line, but
 * complete enough that every screen in the app has something real to show.
 *
 * THE RULE THIS FILE OBEYS: every journal item is produced by calling the real
 * posting engine. Nothing is inserted into journal_item directly. Hand-inserted
 * items that happen to tie are one of the named fakes -- and a judge who posts
 * one manual entry exposes it immediately.
 *
 * THE STORY, in order:
 *
 *   1. 01-Apr  Owner puts Rs 5,00,000 into the business (4,50,000 bank + 50,000 cash)
 *   2. 10-Apr  PO0001 to Azure for 20 tables; only 10 are delivered and billed
 *   3. 20-Apr  Azure's bill paid in full, by bank
 *   4. 05-May  BILL/2026/0002 from Open Wood, raised WITHOUT a PO -- still unpaid
 *   5. 12-May  SO0001 for Nimesh becomes INV/2026/0001
 *   6. 25-May  Nimesh pays it in full, by bank
 *   7. 10-Jun  INV/2026/0002 for Joey, raised WITHOUT a sales order
 *   8. 28-Jun  Joey pays Rs 30,000 of it -- a PART payment
 *   9. 05-Jul  INV/2026/0003 for Nimesh, left open
 *  10. 31-Jul  Showroom rent Rs 20,000, paid in cash, as a manual entry
 *
 * TWO THINGS ARE LEFT DELIBERATELY UNFINISHED so they can be done live:
 *   - PO0001 still has 10 tables unbilled  -> demo the PO -> Bill conversion
 *   - SO0002 (Joey, 3 tables) is not invoiced -> demo the SO -> Invoice conversion
 *
 * WHERE THE BOOKS LAND on 31-Jul-2026:
 *
 *   Assets       Bank 4,68,200 + Cash 30,000 + Debtors 64,400 + Input GST 14,400 = 5,77,000
 *   Liab + Cap   Creditors 23,600 + Output GST 23,400 + Capital 5,00,000 + CYE 30,000 = 5,77,000
 *   P&L          Income 1,30,000 - Purchases 80,000 - Other 20,000 = Net 30,000
 *   Budget       Showroom Fitout: committed 1,00,000, achieved 80,000 (80%)
 *
 * Change a number here and change it in scripts/audit.ts too -- that file
 * restates these figures independently so the two can disagree out loud.
 */

const DEMO_TODAY = accountingDate(process.env.DEMO_TODAY ?? "2026-09-15");
const FY_START = accountingDate("2026-04-01");

const GST_RATE_BP = 1800;

// ─────────────────────────────────────────────────────────────────────────────
//  Reset
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TRUNCATE rather than DELETE: row-level triggers do not fire on TRUNCATE, so
 * this is the one sanctioned way to clear posted ledger rows. Any other route
 * hits `journal_item_is_append_only`, which is exactly the point.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
//  Masters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The eight accounts the mockup mandates ("All this accounts are to be pre
 * configured"), plus seven the engine cannot work without.
 *
 * One deliberate correction: the mockup's CoA LIST types "Other Expense A/c" as
 * `Expense`, but its own P&L formula says "Other Expense - Total of account
 * type Other Expense" and its type dropdown has a distinct Other Expenses leaf.
 * Typing it as EXPENSE would make that P&L row print zero forever and
 * double-count it into Purchase Expense. We follow the report formula.
 */
const ACCOUNTS = [
  { code: "1100", name: "Bank A/c", type: "BANK", subtype: "NONE", mandated: true },
  { code: "1200", name: "Cash A/c", type: "CASH", subtype: "NONE", mandated: true },
  { code: "1300", name: "Debtors A/c", type: "ASSET", subtype: "RECEIVABLE", reconcilable: true, mandated: true },
  { code: "1400", name: "Input GST A/c", type: "ASSET", subtype: "TAX_PAID" },
  { code: "1500", name: "Inventory A/c", type: "ASSET", subtype: "INVENTORY" },
  { code: "2100", name: "Creditors A/c", type: "LIABILITY", subtype: "PAYABLE", reconcilable: true, mandated: true },
  { code: "2200", name: "Output GST A/c", type: "LIABILITY", subtype: "TAX_COLLECTED" },
  { code: "3100", name: "Capital A/c", type: "CAPITAL", subtype: "NONE", mandated: true },
  { code: "3200", name: "Retained Earnings A/c", type: "CAPITAL", subtype: "RETAINED_EARNINGS" },
  { code: "3300", name: "Current Year Earnings", type: "CAPITAL", subtype: "CURRENT_YEAR_EARNINGS" },
  { code: "4100", name: "Sales Income A/c", type: "INCOME", subtype: "NONE", mandated: true },
  { code: "5100", name: "Purchase Expense A/c", type: "EXPENSE", subtype: "NONE", mandated: true },
  { code: "5200", name: "Cost of Goods Sold A/c", type: "EXPENSE", subtype: "COGS" },
  { code: "6100", name: "Other Expense A/c", type: "OTHER_EXPENSE", subtype: "NONE", mandated: true },
  { code: "6900", name: "Rounding Difference A/c", type: "OTHER_EXPENSE", subtype: "ROUNDING" },
] as const;

async function seedMasters() {
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
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const id = (code: string) => byCode.get(code)!.id;

  // The four journals the mockup's Journals list ships pre-seeded.
  await prisma.journal.createMany({
    data: [
      { code: "SAL", name: "Sales", type: "SALES", defaultAccountId: id("4100"), sequencePrefix: "INV" },
      { code: "PUR", name: "Purchase", type: "PURCHASE", defaultAccountId: id("5100"), sequencePrefix: "BILL" },
      { code: "BNK", name: "Bank", type: "BANK", defaultAccountId: id("1100"), sequencePrefix: "BNK" },
      { code: "CSH", name: "Cash", type: "CASH", defaultAccountId: id("1200"), sequencePrefix: "CSH" },
    ],
  });

  const gst = await prisma.tax.create({
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

  // "PO0001" and "SO0001" carry no year segment; the bill and invoice do.
  await prisma.sequence.createMany({
    data: [
      { code: SEQUENCE_CODES.CUSTOMER_INVOICE, prefix: "INV/", fiscalYear: 2026, padding: 4, useYear: true },
      { code: SEQUENCE_CODES.VENDOR_BILL, prefix: "BILL/", fiscalYear: 2026, padding: 4, useYear: true },
      { code: SEQUENCE_CODES.PAYMENT, prefix: "PAY/", fiscalYear: 2026, padding: 4, useYear: true },
      { code: SEQUENCE_CODES.MANUAL_ENTRY, prefix: "JE/", fiscalYear: 2026, padding: 4, useYear: true },
      { code: SEQUENCE_CODES.PURCHASE_ORDER, prefix: "PO", fiscalYear: 2026, padding: 4, useYear: false },
      { code: SEQUENCE_CODES.SALES_ORDER, prefix: "SO", fiscalYear: 2026, padding: 4, useYear: false },
    ],
  });

  const hash = (plain: string) => bcrypt.hashSync(plain, 10);
  await prisma.user.createMany({
    data: [
      { name: "Admin", loginId: "adminuf", email: "admin@urbanfurniture.in", passwordHash: hash("Admin@2026x"), role: "ADMIN" },
      { name: "Priya Accountant", loginId: "priyaacc", email: "priya@urbanfurniture.in", passwordHash: hash("Priya@2026x"), role: "ACCOUNTANT" },
    ],
  });

  const categories = await Promise.all(
    ["Furniture", "Electronics", "Services"].map((name) => prisma.productCategory.create({ data: { name } })),
  );
  const catByName = new Map(categories.map((c) => [c.name, c]));

  const contacts = await Promise.all(
    (
      [
        { name: "Nimesh Pathak", type: "CUSTOMER", email: "nimesh@example.com", mobile: "+91 90900 90901", city: "Ahmedabad" },
        { name: "Joey Wills", type: "CUSTOMER", email: "joey@example.com", mobile: "+91 90900 90902", city: "Mumbai" },
        { name: "Azure Furniture", type: "VENDOR", email: "sales@azurefurniture.in", mobile: "+91 90900 90903", city: "Jaipur" },
        { name: "Open Wood", type: "VENDOR", email: "accounts@openwood.in", mobile: "+91 90900 90904", city: "Nagpur" },
      ] as const
    ).map((c) => prisma.contact.create({ data: { ...c, country: "India" } })),
  );
  const contactByName = new Map(contacts.map((c) => [c.name, c]));

  const products = await Promise.all(
    (
      [
        { name: "Wooden Table", type: "GOODS", salesRupees: 10000, costRupees: 6000, category: "Furniture", trackInventory: true },
        { name: "Office Chair", type: "GOODS", salesRupees: 2000, costRupees: 1000, category: "Furniture", trackInventory: true },
        { name: "Sofa Set", type: "GOODS", salesRupees: 30000, costRupees: 18000, category: "Furniture", trackInventory: true },
        { name: "Delivery Charge", type: "SERVICE", salesRupees: 1000, costRupees: 0, category: "Services", trackInventory: false },
      ] as const
    ).map((p) =>
      prisma.product.create({
        data: {
          name: p.name,
          type: p.type,
          salesPricePaise: rupeesToPaise(p.salesRupees),
          costPaise: rupeesToPaise(p.costRupees),
          categoryId: catByName.get(p.category)!.id,
          trackInventory: p.trackInventory,
          salesTaxId: gst.id,
          purchaseTaxId: gst.id,
        },
      }),
    ),
  );
  const productByName = new Map(products.map((p) => [p.name, p]));

  const analytics = await Promise.all(
    (
      [
        { name: "Showroom Fitout", code: "FIT", type: "EXPENSE" },
        { name: "Retail Sales", code: "RET", type: "INCOME" },
      ] as const
    ).map((a) => prisma.analyticAccount.create({ data: a })),
  );
  const analyticByName = new Map(analytics.map((a) => [a.name, a]));

  // One budget, one line, round numbers: Rs 1,00,000 planned for fitting out
  // the showroom, of which the two vendor bills consume Rs 80,000.
  await prisma.budget.create({
    data: {
      name: "Showroom Fitout Q1",
      startDate: accountingDate("2026-04-01"),
      endDate: accountingDate("2026-06-30"),
      state: "CONFIRMED",
      responsibleId: contactByName.get("Nimesh Pathak")!.id,
      lines: {
        create: [
          {
            analyticAccountId: analyticByName.get("Showroom Fitout")!.id,
            type: "EXPENSE",
            committedPaise: rupeesToPaise(100000),
          },
        ],
      },
    },
  });

  return { byCode, gst, contactByName, productByName, analyticByName };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Document helpers — each Confirm is its own transaction, exactly as it will
//  be when a user clicks the button.
// ─────────────────────────────────────────────────────────────────────────────

interface SeedLine {
  productName: string;
  qty: number;
  unitPriceRupees: number;
  analyticName?: string;
  taxed?: boolean;
}

type Ctx = Awaited<ReturnType<typeof seedMasters>>;

let draftCounter = 0;

function buildLines(ctx: Ctx, lines: SeedLine[]) {
  return lines.map((line, index) => {
    const quantityMilli = qtyToMilli(line.qty);
    const unitPricePaise = rupeesToPaise(line.unitPriceRupees);
    return {
      lineNo: index + 1,
      productId: ctx.productByName.get(line.productName)!.id,
      description: line.productName,
      // accountId intentionally left NULL: the engine resolves it, and the
      // trace then shows which rung actually fired.
      analyticAccountId: line.analyticName ? ctx.analyticByName.get(line.analyticName)!.id : null,
      quantityMilli,
      unitPricePaise,
      taxId: line.taxed === false ? null : ctx.gst.id,
      subtotalPaise: lineSubtotalPaise(quantityMilli, unitPricePaise),
    };
  });
}

async function createAndConfirmInvoice(
  ctx: Ctx,
  input: { customer: string; date: string; dueDays: number; reference?: string; lines: SeedLine[] },
) {
  const lines = buildLines(ctx, input.lines);
  const totals = documentTotals(
    lines.map((l) => ({ subtotalPaise: l.subtotalPaise, taxRateBp: l.taxId ? GST_RATE_BP : null })),
  );
  const invoiceDate = accountingDate(input.date);
  const dueDate = new Date(invoiceDate.getTime() + input.dueDays * 86_400_000);

  const invoice = await prisma.customerInvoice.create({
    data: {
      name: `DRAFT-INV-${++draftCounter}`,
      customerId: ctx.contactByName.get(input.customer)!.id,
      invoiceReference: input.reference ?? null,
      invoiceDate,
      dueDate,
      untaxedPaise: totals.untaxedPaise,
      taxPaise: totals.taxPaise,
      totalPaise: totals.totalPaise,
      residualPaise: totals.totalPaise,
      paymentState: "NOT_PAID",
      lines: { create: lines },
    },
  });

  await prisma.$transaction((tx) => confirmCustomerInvoice(tx as Tx, invoice.id));
  return prisma.customerInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
}

async function createAndConfirmBill(
  ctx: Ctx,
  input: { vendor: string; date: string; dueDays: number; reference?: string; lines: SeedLine[] },
) {
  const lines = buildLines(ctx, input.lines);
  const totals = documentTotals(
    lines.map((l) => ({ subtotalPaise: l.subtotalPaise, taxRateBp: l.taxId ? GST_RATE_BP : null })),
  );
  const billDate = accountingDate(input.date);
  const dueDate = new Date(billDate.getTime() + input.dueDays * 86_400_000);

  const bill = await prisma.vendorBill.create({
    data: {
      name: `DRAFT-BILL-${++draftCounter}`,
      vendorId: ctx.contactByName.get(input.vendor)!.id,
      billReference: input.reference ?? null,
      billDate,
      dueDate,
      untaxedPaise: totals.untaxedPaise,
      taxPaise: totals.taxPaise,
      totalPaise: totals.totalPaise,
      residualPaise: totals.totalPaise,
      paymentState: "NOT_PAID",
      lines: { create: lines },
    },
  });

  await prisma.$transaction((tx) => confirmVendorBill(tx as Tx, bill.id));
  return prisma.vendorBill.findUniqueOrThrow({ where: { id: bill.id } });
}

async function pay(
  ctx: Ctx,
  input: {
    partner: string;
    date: string;
    direction: "SEND" | "RECEIVE";
    method: "BANK" | "CASH";
    amountRupees: number;
    invoiceId?: string;
    billId?: string;
    note?: string;
  },
) {
  const journal = await prisma.journal.findFirstOrThrow({
    where: { type: input.method === "BANK" ? "BANK" : "CASH" },
  });
  const amountPaise = rupeesToPaise(input.amountRupees);

  const payment = await prisma.payment.create({
    data: {
      name: `DRAFT-PAY-${++draftCounter}`,
      direction: input.direction,
      partnerId: ctx.contactByName.get(input.partner)!.id,
      paymentDate: accountingDate(input.date),
      method: input.method,
      journalId: journal.id,
      amountPaise,
      note: input.note ?? null,
    },
  });

  await prisma.$transaction((tx) =>
    confirmPayment(tx as Tx, payment.id, [
      {
        customerInvoiceId: input.invoiceId,
        vendorBillId: input.billId,
        amountPaise,
      },
    ]),
  );
}

/** Rent and similar: a real manual journal entry, posted through the engine. */
async function postExpense(
  ctx: Ctx,
  input: { date: string; amountRupees: number; method: "BANK" | "CASH"; label: string },
) {
  const journal = await prisma.journal.findFirstOrThrow({
    where: { type: input.method === "BANK" ? "BANK" : "CASH" },
  });
  const amountPaise = rupeesToPaise(input.amountRupees);
  const date = accountingDate(input.date);

  await prisma.$transaction(async (tx) => {
    const name = await allocateDocumentNumber(tx as Tx, SEQUENCE_CODES.MANUAL_ENTRY, date);
    await postManualLines(tx as Tx, {
      name,
      journalId: journal.id,
      date,
      ref: input.label,
      lines: [
        {
          accountId: ctx.byCode.get("6100")!.id,
          label: input.label,
          debitPaise: amountPaise,
          creditPaise: 0n,
        },
        {
          accountId: ctx.byCode.get(input.method === "BANK" ? "1100" : "1200")!.id,
          label: input.label,
          debitPaise: 0n,
          creditPaise: amountPaise,
        },
      ],
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  The trading history
// ─────────────────────────────────────────────────────────────────────────────

async function seedTransactions(ctx: Ctx) {
  // ── 1. Opening capital ────────────────────────────────────────────────────
  //    Without this the Balance Sheet has an empty Capital row and the business
  //    has nothing to trade with. Posted as a real manual journal entry, which
  //    is also the screen a judge is most likely to test.
  await prisma.$transaction(async (tx) => {
    const name = await allocateDocumentNumber(tx as Tx, SEQUENCE_CODES.MANUAL_ENTRY, FY_START);
    const bankJournal = await tx.journal.findFirstOrThrow({ where: { type: "BANK" } });
    await postManualLines(tx as Tx, {
      name,
      journalId: bankJournal.id,
      date: FY_START,
      ref: "Owner capital introduced",
      lines: [
        { accountId: ctx.byCode.get("1100")!.id, label: "Opening bank balance", debitPaise: rupeesToPaise(450000), creditPaise: 0n },
        { accountId: ctx.byCode.get("1200")!.id, label: "Opening cash float", debitPaise: rupeesToPaise(50000), creditPaise: 0n },
        { accountId: ctx.byCode.get("3100")!.id, label: "Owner capital", debitPaise: 0n, creditPaise: rupeesToPaise(500000) },
      ],
    });
  });

  // ── 2. PO0001, billed in part ─────────────────────────────────────────────
  //    20 tables ordered, 10 delivered. The other 10 stay billable so the
  //    PO -> Bill conversion can be demonstrated live against real data.
  const po = await prisma.purchaseOrder.create({
    data: {
      name: "DRAFT-PO-0001",
      vendorId: ctx.contactByName.get("Azure Furniture")!.id,
      orderDate: accountingDate("2026-04-10"),
      notes: "Showroom display tables. Delivery in two lots.",
      lines: {
        create: [
          {
            lineNo: 1,
            productId: ctx.productByName.get("Wooden Table")!.id,
            description: "Wooden Table",
            analyticAccountId: ctx.analyticByName.get("Showroom Fitout")!.id,
            quantityMilli: qtyToMilli(20),
            unitPricePaise: rupeesToPaise(6000),
            taxId: ctx.gst.id,
            subtotalPaise: lineSubtotalPaise(qtyToMilli(20), rupeesToPaise(6000)),
          },
        ],
      },
    },
  });
  await prisma.$transaction((tx) => confirmPurchaseOrder(tx as Tx, po.id));

  // Convert, then trim the draft to the 10 that actually arrived.
  const azureBill = await prisma.$transaction(async (tx) => {
    const draft = await createBillFromPurchaseOrder(tx as Tx, po.id, {
      billDate: accountingDate("2026-04-10"),
      billReference: "AZ-26-114",
    });
    const line = await tx.vendorBillLine.findFirstOrThrow({ where: { billId: draft.id } });
    await tx.vendorBillLine.update({
      where: { id: line.id },
      data: {
        quantityMilli: qtyToMilli(10),
        subtotalPaise: lineSubtotalPaise(qtyToMilli(10), rupeesToPaise(6000)),
      },
    });
    return draft;
  });
  await prisma.$transaction((tx) => confirmVendorBill(tx as Tx, azureBill.id));

  // ── 3. Azure paid in full, by bank ────────────────────────────────────────
  await pay(ctx, {
    partner: "Azure Furniture",
    date: "2026-04-20",
    direction: "SEND",
    method: "BANK",
    amountRupees: 70800,
    billId: azureBill.id,
    note: "Payment against AZ-26-114",
  });

  // ── 4. A bill raised WITHOUT a purchase order ─────────────────────────────
  //    This is the one that keeps the PO smart button hidden, and the one that
  //    leaves Creditors non-zero on the Balance Sheet.
  await createAndConfirmBill(ctx, {
    vendor: "Open Wood",
    date: "2026-05-05",
    dueDays: 30,
    reference: "OW-26-088",
    lines: [
      { productName: "Office Chair", qty: 20, unitPriceRupees: 1000, analyticName: "Showroom Fitout" },
    ],
  });

  // ── 5. SO0001 becomes INV/2026/0001 ───────────────────────────────────────
  const so1 = await prisma.salesOrder.create({
    data: {
      name: "DRAFT-SO-0001",
      customerId: ctx.contactByName.get("Nimesh Pathak")!.id,
      orderDate: accountingDate("2026-05-12"),
      lines: {
        create: [
          {
            lineNo: 1,
            productId: ctx.productByName.get("Wooden Table")!.id,
            description: "Wooden Table",
            analyticAccountId: ctx.analyticByName.get("Retail Sales")!.id,
            quantityMilli: qtyToMilli(5),
            unitPricePaise: rupeesToPaise(10000),
            taxId: ctx.gst.id,
            subtotalPaise: lineSubtotalPaise(qtyToMilli(5), rupeesToPaise(10000)),
          },
        ],
      },
    },
  });
  await prisma.$transaction((tx) => confirmSalesOrder(tx as Tx, so1.id));

  const nimeshInvoice = await prisma.$transaction((tx) =>
    createInvoiceFromSalesOrder(tx as Tx, so1.id, {
      invoiceDate: accountingDate("2026-05-12"),
      invoiceReference: "SO-26-001",
    }),
  );
  await prisma.$transaction((tx) => confirmCustomerInvoice(tx as Tx, nimeshInvoice.id));

  // ── 6. Nimesh pays it in full ─────────────────────────────────────────────
  await pay(ctx, {
    partner: "Nimesh Pathak",
    date: "2026-05-25",
    direction: "RECEIVE",
    method: "BANK",
    amountRupees: 59000,
    invoiceId: nimeshInvoice.id,
    note: "Receipt against INV/2026/0001",
  });

  // ── 7. An invoice raised WITHOUT a sales order ────────────────────────────
  const joeyInvoice = await createAndConfirmInvoice(ctx, {
    customer: "Joey Wills",
    date: "2026-06-10",
    dueDays: 30,
    reference: "JW-26-002",
    lines: [
      { productName: "Sofa Set", qty: 2, unitPriceRupees: 30000, analyticName: "Retail Sales" },
    ],
  });

  // ── 8. ...paid only in part. Residual 40,800, badge reads PARTIAL. ─────────
  await pay(ctx, {
    partner: "Joey Wills",
    date: "2026-06-28",
    direction: "RECEIVE",
    method: "BANK",
    amountRupees: 30000,
    invoiceId: joeyInvoice.id,
    note: "Part payment against INV/2026/0002",
  });

  // ── 9. An invoice left completely open ────────────────────────────────────
  //    The bank statement settles this one during the reconciliation demo, so
  //    leave it untouched.
  await createAndConfirmInvoice(ctx, {
    customer: "Nimesh Pathak",
    date: "2026-07-05",
    dueDays: 30,
    reference: "NP-26-003",
    lines: [
      { productName: "Office Chair", qty: 10, unitPriceRupees: 2000, analyticName: "Retail Sales" },
    ],
  });

  // ── 10. Showroom rent, in cash ────────────────────────────────────────────
  //     The only Other Expense in the books, so that P&L row has exactly one
  //     thing in it and is easy to point at.
  await postExpense(ctx, {
    date: "2026-07-31",
    amountRupees: 20000,
    method: "CASH",
    label: "Showroom rent",
  });

  // ── Left unfinished on purpose: SO0002 ────────────────────────────────────
  //    Confirmed, never invoiced. Convert it live to show SO -> Invoice.
  const so2 = await prisma.salesOrder.create({
    data: {
      name: "DRAFT-SO-0002",
      customerId: ctx.contactByName.get("Joey Wills")!.id,
      orderDate: accountingDate("2026-07-20"),
      notes: "Awaiting delivery slot. Invoice on dispatch.",
      lines: {
        create: [
          {
            lineNo: 1,
            productId: ctx.productByName.get("Wooden Table")!.id,
            description: "Wooden Table",
            analyticAccountId: ctx.analyticByName.get("Retail Sales")!.id,
            quantityMilli: qtyToMilli(3),
            unitPricePaise: rupeesToPaise(10000),
            taxId: ctx.gst.id,
            subtotalPaise: lineSubtotalPaise(qtyToMilli(3), rupeesToPaise(10000)),
          },
        ],
      },
    },
  });
  await prisma.$transaction((tx) => confirmSalesOrder(tx as Tx, so2.id));
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Resetting database...");
  await reset();

  console.log("Seeding masters...");
  const ctx = await seedMasters();

  console.log("Posting trading history through the real posting engine...");
  await seedTransactions(ctx);

  const items = await prisma.journalItem.count({ where: { state: "POSTED" } });
  const entries = await prisma.journalEntry.count({ where: { state: "POSTED" } });
  const totals = await prisma.journalItem.aggregate({
    where: { state: "POSTED" },
    _sum: { debitPaise: true, creditPaise: true },
  });

  console.log("");
  console.log(`  ${items} journal items across ${entries} entries`);
  console.log(`  Debits  ${formatINR(totals._sum.debitPaise ?? 0n)}`);
  console.log(`  Credits ${formatINR(totals._sum.creditPaise ?? 0n)}`);
  console.log(`  Demo date ${DEMO_TODAY.toISOString().slice(0, 10)}`);
  console.log("");
  console.log("Run `npm run audit` to verify the books tie out.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

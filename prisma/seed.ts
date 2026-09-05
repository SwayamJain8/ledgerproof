import "dotenv/config";
import bcrypt from "bcryptjs";

import { prisma, type Tx } from "../src/lib/db";
import { accountingDate } from "../src/lib/accounting/dates";
import { lineSubtotalPaise, rupeesToPaise, qtyToMilli, formatINR } from "../src/lib/money";
import { documentTotals, confirmCustomerInvoice, confirmVendorBill, confirmPayment } from "../src/lib/accounting/documents";
import { postManualLines } from "../src/lib/accounting/posting";
import { allocateDocumentNumber, SEQUENCE_CODES } from "../src/lib/accounting/sequence";

/**
 * SEED — five and a half months of trading history for Urban Furniture,
 * 01-Apr-2026 to 15-Sep-2026.
 *
 * THE RULE THIS FILE OBEYS: every journal item is produced by calling the real
 * posting engine. Nothing is inserted into journal_item directly. Hand-inserted
 * items that happen to tie are one of the named fakes -- and a judge who posts
 * one manual entry exposes it immediately.
 *
 * The target figures come from the demo script (section 10), which
 * FIXES_TO_APPLY declares canonical. If you change one number here, change it
 * there too:
 *
 *   Assets      Bank 6,15,000 + Cash 65,000 + Debtors 2,58,000 + Input GST 54,000  = 9,92,000
 *   Liab+Cap    Creditors 74,000 + Output GST 1,08,000 + Capital 6,00,000 + CYE 2,10,000 = 9,92,000
 *   P&L         Income 6,00,000 - Purchase 3,00,000 - Other 90,000 = Net 2,10,000
 *   Budget      Q2 Furniture Procurement / Project 1: committed 1,60,000, achieved 1,48,000
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
        { name: "Nimesh Pathak", type: "CUSTOMER", email: "nimesh@example.com", mobile: "+91 9090090901", city: "Ahmedabad" },
        { name: "Rahul Sharma", type: "CUSTOMER", email: "rahul@example.com", mobile: "+91 9090090902", city: "Surat" },
        { name: "Joey Wills", type: "CUSTOMER", email: "joey@example.com", mobile: "+91 9090090903", city: "Mumbai" },
        { name: "Azure Furniture", type: "VENDOR", email: "sales@azurefurniture.in", mobile: "+91 9090090904", city: "Jaipur" },
        { name: "Open Wood", type: "VENDOR", email: "openwood21@example.com", mobile: "+91 9090090905", city: "Nagpur" },
      ] as const
    ).map((c) => prisma.contact.create({ data: { ...c, country: "India" } })),
  );
  const contactByName = new Map(contacts.map((c) => [c.name, c]));

  const products = await Promise.all(
    (
      [
        { name: "Wooden Table", type: "GOODS", salesRupees: 5000, costRupees: 3000, category: "Furniture", trackInventory: true },
        { name: "Office Chair", type: "GOODS", salesRupees: 2500, costRupees: 1200, category: "Furniture", trackInventory: true },
        { name: "Sofa Set", type: "GOODS", salesRupees: 28000, costRupees: 15000, category: "Furniture", trackInventory: true },
        { name: "Dining Table", type: "GOODS", salesRupees: 22000, costRupees: 12000, category: "Furniture", trackInventory: true },
        { name: "Cushion", type: "GOODS", salesRupees: 900, costRupees: 500, category: "Furniture", trackInventory: true },
        { name: "Delivery Charge", type: "SERVICE", salesRupees: 2400, costRupees: 0, category: "Services", trackInventory: false },
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
        { name: "Project 1", code: "P1", type: "EXPENSE" },
        { name: "Showroom-West", code: "SW", type: "INCOME" },
        { name: "Furniture", code: "FUR", type: "EXPENSE" },
      ] as const
    ).map((a) => prisma.analyticAccount.create({ data: a })),
  );
  const analyticByName = new Map(analytics.map((a) => [a.name, a]));

  await prisma.budget.create({
    data: {
      name: "Q2 Furniture Procurement",
      startDate: accountingDate("2026-07-01"),
      endDate: accountingDate("2026-09-30"),
      state: "CONFIRMED",
      responsibleId: contactByName.get("Nimesh Pathak")!.id,
      lines: {
        create: [
          {
            analyticAccountId: analyticByName.get("Project 1")!.id,
            type: "EXPENSE",
            committedPaise: rupeesToPaise(160000),
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
  // ── Opening capital. Without it the Balance Sheet has an empty Capital row
  //    and cannot balance -- and the mockup draws a Capital row.
  await prisma.$transaction(async (tx) => {
    const name = await allocateDocumentNumber(tx as Tx, SEQUENCE_CODES.MANUAL_ENTRY, FY_START);
    await postManualLines(tx as Tx, {
      name,
      journalId: (await tx.journal.findFirstOrThrow({ where: { type: "BANK" } })).id,
      date: FY_START,
      ref: "Owner's opening capital",
      sourceType: "OPENING_BALANCE",
      lines: [
        { accountId: ctx.byCode.get("1100")!.id, label: "Opening bank", debitPaise: rupeesToPaise(600000), creditPaise: 0n },
        { accountId: ctx.byCode.get("3100")!.id, label: "Owner's capital", debitPaise: 0n, creditPaise: rupeesToPaise(600000) },
      ],
    });
  });

  // ── Sales: 120 Wooden Tables at Rs 5,000 across 12 invoices = Rs 6,00,000 net.
  //    Every line carries GST 18%, so Output GST lands on exactly 1,08,000.
  const invoicePlan: { date: string; qty: number; customer: string }[] = [
    { date: "2026-04-05", qty: 8, customer: "Nimesh Pathak" },
    { date: "2026-04-20", qty: 10, customer: "Rahul Sharma" },
    { date: "2026-05-06", qty: 12, customer: "Joey Wills" },
    { date: "2026-05-22", qty: 9, customer: "Nimesh Pathak" },
    { date: "2026-06-04", qty: 11, customer: "Rahul Sharma" },
    { date: "2026-06-21", qty: 10, customer: "Joey Wills" },
    { date: "2026-07-07", qty: 12, customer: "Nimesh Pathak" },
    { date: "2026-07-23", qty: 8, customer: "Rahul Sharma" },
    { date: "2026-08-05", qty: 10, customer: "Joey Wills" },
    { date: "2026-08-24", qty: 11, customer: "Nimesh Pathak" },
    { date: "2026-09-02", qty: 9, customer: "Rahul Sharma" },
    { date: "2026-09-10", qty: 10, customer: "Joey Wills" },
  ];

  const invoices = [];
  for (const [index, plan] of invoicePlan.entries()) {
    invoices.push(
      await createAndConfirmInvoice(ctx, {
        customer: plan.customer,
        date: plan.date,
        dueDays: 30,
        reference: `SO-26-${String(index + 1).padStart(3, "0")}`,
        lines: [
          { productName: "Wooden Table", qty: plan.qty, unitPriceRupees: 5000, analyticName: "Showroom-West" },
        ],
      }),
    );
  }

  // ── Receipts. Invoices 1-7 settled in full, invoice 8 partially, 9-12 open.
  //    That leaves Debtors at exactly 2,58,000, with three open invoices inside
  //    the 0-30 day age bucket as of 15-Sep.
  const receiptPlan: { index: number; date: string; method: "BANK" | "CASH"; rupees: number }[] = [
    { index: 0, date: "2026-04-28", method: "BANK", rupees: 47200 },
    { index: 1, date: "2026-05-14", method: "CASH", rupees: 59000 },
    { index: 2, date: "2026-05-30", method: "BANK", rupees: 70800 },
    { index: 3, date: "2026-06-15", method: "BANK", rupees: 53100 },
    { index: 4, date: "2026-06-29", method: "BANK", rupees: 64900 },
    { index: 5, date: "2026-07-14", method: "CASH", rupees: 59000 },
    { index: 6, date: "2026-08-02", method: "BANK", rupees: 70800 },
    { index: 7, date: "2026-08-18", method: "BANK", rupees: 25200 },
  ];
  for (const receipt of receiptPlan) {
    const invoice = invoices[receipt.index];
    await pay(ctx, {
      partner: (await prisma.contact.findUniqueOrThrow({ where: { id: invoice.customerId } })).name,
      date: receipt.date,
      direction: "RECEIVE",
      method: receipt.method,
      amountRupees: receipt.rupees,
      invoiceId: invoice.id,
      note: `Receipt against ${invoice.name}`,
    });
  }

  // ── Purchases: Rs 3,00,000 net, all at GST 18% so Input GST is exactly 54,000.
  //    The three Q2 bills are tagged Project 1 and total 1,48,000 -- which is
  //    what the budget's Achieved column reads.
  const billPlan: { date: string; vendor: string; analytic?: string; lines: SeedLine[] }[] = [
    { date: "2026-04-10", vendor: "Azure Furniture", lines: [{ productName: "Office Chair", qty: 50, unitPriceRupees: 1200, analyticName: "Furniture" }] },
    {
      date: "2026-05-12",
      vendor: "Open Wood",
      lines: [
        { productName: "Wooden Table", qty: 10, unitPriceRupees: 3000, analyticName: "Furniture" },
        { productName: "Cushion", qty: 40, unitPriceRupees: 500, analyticName: "Furniture" },
      ],
    },
    { date: "2026-06-18", vendor: "Azure Furniture", lines: [{ productName: "Office Chair", qty: 35, unitPriceRupees: 1200, analyticName: "Furniture" }] },
    { date: "2026-07-09", vendor: "Open Wood", lines: [{ productName: "Sofa Set", qty: 4, unitPriceRupees: 15000, analyticName: "Project 1" }] },
    {
      date: "2026-08-11",
      vendor: "Azure Furniture",
      lines: [
        { productName: "Office Chair", qty: 40, unitPriceRupees: 1200, analyticName: "Project 1" },
        { productName: "Cushion", qty: 8, unitPriceRupees: 500, analyticName: "Project 1" },
      ],
    },
    { date: "2026-09-04", vendor: "Open Wood", lines: [{ productName: "Dining Table", qty: 3, unitPriceRupees: 12000, analyticName: "Project 1" }] },
  ];

  const bills = [];
  for (const [index, plan] of billPlan.entries()) {
    bills.push(
      await createAndConfirmBill(ctx, {
        vendor: plan.vendor,
        date: plan.date,
        dueDays: 30,
        reference: `ABC-26-${String(index + 1).padStart(3, "0")}`,
        lines: plan.lines,
      }),
    );
  }

  // ── Vendor payments. Bills 1, 2 and 4 in full; bill 3 split across cash and
  //    bank; bill 5 partially. Bill 6 untouched. Creditors lands on 74,000.
  const vendorPayPlan: { index: number; date: string; method: "BANK" | "CASH"; rupees: number }[] = [
    { index: 0, date: "2026-05-05", method: "BANK", rupees: 70800 },
    { index: 1, date: "2026-06-08", method: "BANK", rupees: 59000 },
    { index: 2, date: "2026-07-02", method: "CASH", rupees: 23000 },
    { index: 2, date: "2026-07-16", method: "BANK", rupees: 26560 },
    { index: 3, date: "2026-08-06", method: "BANK", rupees: 70800 },
    { index: 4, date: "2026-09-08", method: "BANK", rupees: 29840 },
  ];
  for (const payment of vendorPayPlan) {
    const bill = bills[payment.index];
    await pay(ctx, {
      partner: (await prisma.contact.findUniqueOrThrow({ where: { id: bill.vendorId } })).name,
      date: payment.date,
      direction: "SEND",
      method: payment.method,
      amountRupees: payment.rupees,
      billId: bill.id,
      note: `Payment against ${bill.name}`,
    });
  }

  // ── Showroom rent, Rs 15,000 a month for six months = Rs 90,000 of Other
  //    Expense. Two months paid in cash, four by bank.
  const rentPlan: { date: string; method: "BANK" | "CASH" }[] = [
    { date: "2026-04-30", method: "BANK" },
    { date: "2026-05-31", method: "CASH" },
    { date: "2026-06-30", method: "BANK" },
    { date: "2026-07-31", method: "CASH" },
    { date: "2026-08-31", method: "BANK" },
    { date: "2026-09-15", method: "BANK" },
  ];
  for (const rent of rentPlan) {
    await postExpense(ctx, {
      date: rent.date,
      amountRupees: 15000,
      method: rent.method,
      label: "Showroom rent",
    });
  }
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

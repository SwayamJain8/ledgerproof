import type { Tx } from "@/lib/db";
import type { EntrySource, JournalType } from "@/generated/prisma/enums";
import type { JournalModel as Journal } from "@/generated/prisma/models";
import { PostingError, UnbalancedEntryError } from "./errors";
import { sealEntry } from "./chain";
import { atUtcMidnight } from "./dates";
import { taxOnLinePaise } from "@/lib/money";
import {
  loadPostingContext,
  resolveControlAccount,
  resolveExpenseAccount,
  resolveMoneyAccount,
  resolveRevenueAccount,
  resolveTaxAccount,
  type PostingContext,
  type TraceEntry,
} from "./resolution";

/**
 * THE POSTING ENGINE.
 *
 * This module is the only place in the codebase that writes to journal_item.
 * Reports read that table and nothing else, so this file is the single point
 * where a document becomes a financial fact.
 *
 * Its whole job is four steps:
 *   1. Ask configuration which account each amount belongs to (resolution.ts).
 *   2. Emit one journal item per document line, carrying partner and analytic.
 *   3. Derive the final balancing line by SUBTRACTION, never by an independent
 *      calculation. This is the quiet part that removes an entire class of bug.
 *   4. Hand the result to Postgres, whose deferred trigger verifies it balances.
 */

export interface PostingLine {
  accountId: string;
  partnerId?: string | null;
  analyticAccountId?: string | null;
  productId?: string | null;
  taxId?: string | null;
  label: string;
  debitPaise: bigint;
  creditPaise: bigint;
}

/** The account the balancing line lands on. */
export interface ControlAccount {
  accountId: string;
  partnerId?: string | null;
}

/**
 * A generic document line, as far as the engine is concerned. All four document
 * types collapse to this shape, which is why there is one builder and not four.
 */
export interface EngineLine {
  /** The mockup's per-line "Chart of Accounts" override. */
  accountId?: string | null;
  productId?: string | null;
  analyticAccountId?: string | null;
  taxId?: string | null;
  /** Already CHECK-verified against qty x price by the database. */
  subtotalPaise: bigint;
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  The balancing line, derived
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Push the one line that makes the entry balance.
 *
 * The control line is DEFINED as "whatever makes debits equal credits". Even if
 * every other line carries a rounding quirk, the entry cannot come out lopsided
 * -- the quirk lands on the receivable or payable, which is the
 * accounting-correct place for it.
 *
 * Compute this line independently instead (`total = subtotal + tax`) and you
 * reintroduce exactly the bug this design exists to prevent.
 */
export function closeEntry(lines: PostingLine[], control: ControlAccount | null): void {
  const debit = lines.reduce((sum, l) => sum + l.debitPaise, 0n);
  const credit = lines.reduce((sum, l) => sum + l.creditPaise, 0n);
  const difference = debit - credit;

  // A manual entry arrives balanced and needs no control line.
  if (difference === 0n) return;

  if (!control) {
    throw new PostingError("NO_CONTROL_ACCOUNT", {
      debitPaise: debit.toString(),
      creditPaise: credit.toString(),
    });
  }

  lines.push(
    difference > 0n
      ? { ...control, label: "Payable", debitPaise: 0n, creditPaise: difference }
      : { ...control, label: "Receivable", debitPaise: -difference, creditPaise: 0n },
  );
}

/**
 * Belt. The deferred trigger `journal_entry_must_balance` is the braces, and it
 * is the one that holds even against a seed script or a raw API call -- but
 * failing here gives a better error message and a stack trace.
 */
export function assertBalanced(lines: PostingLine[]): { debitPaise: bigint; creditPaise: bigint } {
  const debitPaise = lines.reduce((sum, l) => sum + l.debitPaise, 0n);
  const creditPaise = lines.reduce((sum, l) => sum + l.creditPaise, 0n);
  if (debitPaise !== creditPaise) {
    throw new UnbalancedEntryError(debitPaise, creditPaise);
  }
  if (lines.length < 2) {
    throw new PostingError("EMPTY_DOCUMENT", { lineCount: lines.length });
  }
  return { debitPaise, creditPaise };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Journal and date — two rules straight off the mockup, both easy to get wrong
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The journal is FORCED by document type, never chosen by the user:
 * "In case of bill journal would always be Purchase", and Sales by symmetry.
 * A payment uses the Bank or Cash journal behind its "Payment Via" field.
 */
export async function resolveJournalByType(tx: Tx, type: JournalType): Promise<Journal> {
  const journal = await tx.journal.findFirst({ where: { type, active: true } });
  if (!journal) throw new PostingError("NO_JOURNAL", { type });
  return journal;
}

/**
 * The period lock. No entry may be posted on or before the lock date --
 * "Period locked by Admin on 31-Mar-2026."
 */
async function assertPeriodOpen(ctx: PostingContext, date: Date): Promise<void> {
  const lockDate = ctx.company.lockDate;
  if (lockDate && atUtcMidnight(date) <= atUtcMidnight(lockDate)) {
    throw new PostingError("PERIOD_LOCKED", {
      date: date.toISOString().slice(0, 10),
      lockDate: lockDate.toISOString().slice(0, 10),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  The builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One builder, one direction flag. A sales document credits its net lines and
 * its tax; a purchase document debits both. Everything else -- the resolution
 * chains, the per-line analytic tag, the derived control line -- is identical,
 * which is the actual reason four document types need one engine.
 */
async function buildDocumentLines(
  ctx: PostingContext,
  direction: "SALE" | "PURCHASE",
  lines: EngineLine[],
): Promise<PostingLine[]> {
  if (lines.length === 0) throw new PostingError("EMPTY_DOCUMENT");

  const out: PostingLine[] = [];
  /** taxAccountId -> paise. Tax is rounded PER LINE and then summed. */
  const taxBuckets = new Map<string, bigint>();

  for (const line of lines) {
    const accountId =
      direction === "SALE"
        ? await resolveRevenueAccount(ctx, line, line.subtotalPaise)
        : await resolveExpenseAccount(ctx, line, line.subtotalPaise);

    out.push({
      accountId,
      // Partner belongs on the control line only; the revenue/expense side of
      // the entry is about what happened, not who it happened with.
      partnerId: null,
      analyticAccountId: line.analyticAccountId ?? null,
      productId: line.productId ?? null,
      label: line.label,
      debitPaise: direction === "SALE" ? 0n : line.subtotalPaise,
      creditPaise: direction === "SALE" ? line.subtotalPaise : 0n,
    });

    if (line.taxId) {
      const tax = await ctx.tx.tax.findUnique({ where: { id: line.taxId } });
      if (!tax) throw new PostingError("NO_TAX_ACCOUNT", { taxId: line.taxId });
      const amount = taxOnLinePaise(line.subtotalPaise, tax.rateBp);
      if (amount > 0n) {
        const taxAccountId = await resolveTaxAccount(ctx, line.taxId, direction, amount);
        taxBuckets.set(taxAccountId, (taxBuckets.get(taxAccountId) ?? 0n) + amount);
      }
    }
  }

  for (const [accountId, amount] of taxBuckets) {
    out.push({
      accountId,
      partnerId: null,
      label: direction === "SALE" ? "Output tax" : "Input tax",
      debitPaise: direction === "SALE" ? 0n : amount,
      creditPaise: direction === "SALE" ? amount : 0n,
    });
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Writing the entry
// ─────────────────────────────────────────────────────────────────────────────

export interface WriteEntryInput {
  name: string;
  journalId: string;
  /** The ACCOUNTING date, taken from the source document. Never `new Date()`. */
  date: Date;
  ref?: string | null;
  partnerId?: string | null;
  sourceType: EntrySource;
  sourceId?: string | null;
  lines: PostingLine[];
  trace?: TraceEntry[];
  postedById?: string | null;
}

/**
 * Insert a balanced, already-POSTED entry.
 *
 * Items are written POSTED in the same statement batch as the header, which is
 * safe: the append-only trigger fires on UPDATE and DELETE, not INSERT. The
 * "items before header" ordering rule only applies when flipping an existing
 * draft, which is what `postManualEntry` does.
 */
export async function writePostedEntry(tx: Tx, input: WriteEntryInput) {
  const { debitPaise, creditPaise } = assertBalanced(input.lines);
  const date = atUtcMidnight(input.date);

  const entry = await tx.journalEntry.create({
    data: {
      name: input.name,
      journalId: input.journalId,
      date,
      ref: input.ref ?? null,
      partnerId: input.partnerId ?? null,
      state: "POSTED",
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      totalDebitPaise: debitPaise,
      totalCreditPaise: creditPaise,
      postingTrace: input.trace ? JSON.parse(JSON.stringify(input.trace)) : undefined,
      postedAt: new Date(),
      postedById: input.postedById ?? null,
    },
  });

  await tx.journalItem.createMany({
    data: input.lines.map((line, index) => ({
      entryId: entry.id,
      lineNo: index + 1,
      accountId: line.accountId,
      label: line.label,
      debitPaise: line.debitPaise,
      creditPaise: line.creditPaise,
      // The four denormalised columns. A deferred trigger asserts they really
      // do mirror the header, which is what makes it safe for every report to
      // read journal_item without ever joining upward.
      date,
      state: "POSTED",
      journalId: input.journalId,
      partnerId: line.partnerId ?? null,
      analyticAccountId: line.analyticAccountId ?? null,
      productId: line.productId ?? null,
      taxId: line.taxId ?? null,
    })),
  });

  // Seal it onto the hash chain. Must be after the items exist -- they are part
  // of what is hashed -- and inside this transaction, so a rolled-back post
  // leaves no gap in the chain.
  await sealEntry(tx, entry.id);

  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
//  The three document postings
// ─────────────────────────────────────────────────────────────────────────────

export interface PostDocumentResult {
  entryId: string;
  entryName: string;
  totalPaise: bigint;
  trace: TraceEntry[];
}

/**
 * Dr Debtors / Cr Sales Income / Cr Output GST
 *
 * "As soon as the Customer Invoice is confirmed a journal entry would be
 *  created that would become visible in the Journal Entries section."
 */
export async function buildInvoicePosting(
  tx: Tx,
  input: {
    name: string;
    date: Date;
    ref?: string | null;
    customerId: string;
    lines: EngineLine[];
    sourceId: string;
    postedById?: string | null;
  },
) {
  const journal = await resolveJournalByType(tx, "SALES");
  const ctx = await loadPostingContext(tx, journal);
  await assertPeriodOpen(ctx, input.date);

  const lines = await buildDocumentLines(ctx, "SALE", input.lines);

  const credited = lines.reduce((s, l) => s + l.creditPaise, 0n);
  const control: ControlAccount = {
    accountId: await resolveControlAccount(ctx, input.customerId, "RECEIVABLE", credited),
    partnerId: input.customerId,
  };
  closeEntry(lines, control);

  return { journal, ctx, lines, control };
}

export async function postCustomerInvoice(
  tx: Tx,
  input: {
    name: string;
    date: Date;
    ref?: string | null;
    customerId: string;
    lines: EngineLine[];
    sourceId: string;
    postedById?: string | null;
  },
): Promise<PostDocumentResult> {
  const { journal, ctx, lines } = await buildInvoicePosting(tx, input);

  const entry = await writePostedEntry(tx, {
    name: input.name,
    journalId: journal.id,
    date: input.date,
    ref: input.ref,
    partnerId: input.customerId,
    sourceType: "CUSTOMER_INVOICE",
    sourceId: input.sourceId,
    lines,
    trace: ctx.trace,
    postedById: input.postedById,
  });

  return {
    entryId: entry.id,
    entryName: entry.name,
    totalPaise: entry.totalDebitPaise,
    trace: ctx.trace,
  };
}

/**
 * Dr Purchase Expense / Dr Input GST / Cr Creditors
 *
 * "For Vendor bill always purchase chart of account would be set by default /
 *  The Journal Entry should always be balanced."
 */
export async function postVendorBill(
  tx: Tx,
  input: {
    name: string;
    date: Date;
    ref?: string | null;
    vendorId: string;
    lines: EngineLine[];
    sourceId: string;
    postedById?: string | null;
  },
): Promise<PostDocumentResult> {
  const journal = await resolveJournalByType(tx, "PURCHASE");
  const ctx = await loadPostingContext(tx, journal);
  await assertPeriodOpen(ctx, input.date);

  const lines = await buildDocumentLines(ctx, "PURCHASE", input.lines);

  const debited = lines.reduce((s, l) => s + l.debitPaise, 0n);
  const control: ControlAccount = {
    accountId: await resolveControlAccount(ctx, input.vendorId, "PAYABLE", debited),
    partnerId: input.vendorId,
  };
  closeEntry(lines, control);

  const entry = await writePostedEntry(tx, {
    name: input.name,
    journalId: journal.id,
    date: input.date,
    ref: input.ref,
    partnerId: input.vendorId,
    sourceType: "VENDOR_BILL",
    sourceId: input.sourceId,
    lines,
    trace: ctx.trace,
    postedById: input.postedById,
  });

  return {
    entryId: entry.id,
    entryName: entry.name,
    totalPaise: entry.totalDebitPaise,
    trace: ctx.trace,
  };
}

/**
 * RECEIVE:  Dr Bank/Cash  / Cr Debtors
 * SEND:     Dr Creditors  / Cr Bank/Cash
 *
 * Nothing here touches Income. The sale was earned when the invoice posted, not
 * when the money arrived -- that is the accrual principle, and treating a
 * payment as revenue is exactly what fake systems get wrong.
 *
 * The mockup only draws entries for Bill and Invoice confirmation. Without this
 * one the Balance Sheet's Bank and Cash rows stay permanently zero and Debtors
 * never clears, so the report they drew cannot be produced. It is required, not
 * a flourish.
 */
export async function postPayment(
  tx: Tx,
  input: {
    name: string;
    date: Date;
    ref?: string | null;
    partnerId: string;
    direction: "SEND" | "RECEIVE";
    journalId: string;
    amountPaise: bigint;
    sourceId: string;
    postedById?: string | null;
  },
): Promise<PostDocumentResult> {
  const journal = await tx.journal.findUnique({ where: { id: input.journalId } });
  if (!journal) throw new PostingError("NO_JOURNAL", { journalId: input.journalId });

  const ctx = await loadPostingContext(tx, journal);
  await assertPeriodOpen(ctx, input.date);

  const moneyAccountId = resolveMoneyAccount(ctx, input.amountPaise);
  const receiving = input.direction === "RECEIVE";

  const lines: PostingLine[] = [
    {
      accountId: moneyAccountId,
      partnerId: null,
      label: receiving ? "Money received" : "Money paid",
      debitPaise: receiving ? input.amountPaise : 0n,
      creditPaise: receiving ? 0n : input.amountPaise,
    },
  ];

  const control: ControlAccount = {
    accountId: await resolveControlAccount(
      ctx,
      input.partnerId,
      receiving ? "RECEIVABLE" : "PAYABLE",
      input.amountPaise,
    ),
    partnerId: input.partnerId,
  };
  closeEntry(lines, control);

  const entry = await writePostedEntry(tx, {
    name: input.name,
    journalId: journal.id,
    date: input.date,
    ref: input.ref,
    partnerId: input.partnerId,
    sourceType: "PAYMENT",
    sourceId: input.sourceId,
    lines,
    trace: ctx.trace,
    postedById: input.postedById,
  });

  return {
    entryId: entry.id,
    entryName: entry.name,
    totalPaise: entry.totalDebitPaise,
    trace: ctx.trace,
  };
}

/**
 * An opening-balance entry, used once by the seed to put the owner's capital
 * into the books. Without it the Balance Sheet has an empty Capital row and
 * cannot balance -- and the mockup draws a Capital row.
 */
export async function postManualLines(
  tx: Tx,
  input: {
    name: string;
    journalId: string;
    date: Date;
    ref?: string | null;
    partnerId?: string | null;
    sourceType?: EntrySource;
    lines: PostingLine[];
    postedById?: string | null;
  },
): Promise<PostDocumentResult> {
  const journal = await tx.journal.findUnique({ where: { id: input.journalId } });
  if (!journal) throw new PostingError("NO_JOURNAL", { journalId: input.journalId });

  const ctx = await loadPostingContext(tx, journal);
  await assertPeriodOpen(ctx, input.date);

  const entry = await writePostedEntry(tx, {
    name: input.name,
    journalId: input.journalId,
    date: input.date,
    ref: input.ref,
    partnerId: input.partnerId,
    sourceType: input.sourceType ?? "MANUAL",
    lines: input.lines,
    postedById: input.postedById,
  });

  return {
    entryId: entry.id,
    entryName: entry.name,
    totalPaise: entry.totalDebitPaise,
    trace: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Draft manual entries, and undoing things
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Post a manual journal entry the user typed into the mockup's Journal Entry
 * form. This is the path the BLOCKING debit-vs-credit rule guards.
 *
 * ORDERING: items are flipped to POSTED BEFORE the header, because the
 * append-only trigger reads the parent's state. Reverse these two statements
 * and the engine locks itself out.
 */
export async function postManualEntry(tx: Tx, entryId: string, postedById?: string | null) {
  const entry = await tx.journalEntry.findUnique({
    where: { id: entryId },
    include: { items: true },
  });
  if (!entry) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "JournalEntry", entryId });
  if (entry.state === "POSTED") throw new PostingError("ALREADY_POSTED", { entryId });

  const debitPaise = entry.items.reduce((s, i) => s + i.debitPaise, 0n);
  const creditPaise = entry.items.reduce((s, i) => s + i.creditPaise, 0n);
  if (entry.items.length < 2) throw new PostingError("EMPTY_DOCUMENT", { entryId });
  if (debitPaise !== creditPaise) throw new UnbalancedEntryError(debitPaise, creditPaise);

  const company = await tx.companySettings.findUnique({ where: { id: 1 } });
  if (company?.lockDate && atUtcMidnight(entry.date) <= atUtcMidnight(company.lockDate)) {
    throw new PostingError("PERIOD_LOCKED", { entryId });
  }

  await tx.journalItem.updateMany({
    where: { entryId },
    data: { state: "POSTED" },
  });

  const posted = await tx.journalEntry.update({
    where: { id: entryId },
    data: {
      state: "POSTED",
      totalDebitPaise: debitPaise,
      totalCreditPaise: creditPaise,
      postedAt: new Date(),
      postedById: postedById ?? null,
    },
  });

  await sealEntry(tx, posted.id);
  return posted;
}

/**
 * Cancel a posted entry by writing its mirror image. Both rows stay in the
 * books forever, the net effect on every report is zero, and the audit trail
 * shows what happened and when.
 *
 * There is no Edit and no Delete. `journal_item_is_append_only` makes sure of it.
 */

/**
 * Residual recomputation, kept here rather than imported from documents.ts.
 *
 * documents.ts already imports the posting functions from this file, so
 * importing back the other way would make the two modules circular. The rule is
 * identical: residual = total - the sum of CONFIRMED allocations, and the badge
 * follows the residual because `invoice_payment_state_correct` insists on it.
 */
function badgeFor(totalPaise: bigint, residualPaise: bigint) {
  if (residualPaise === 0n) return "PAID" as const;
  if (residualPaise === totalPaise) return "NOT_PAID" as const;
  return "PARTIAL" as const;
}

async function restoreInvoiceResidual(tx: Tx, invoiceId: string) {
  const invoice = await tx.customerInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const agg = await tx.paymentAllocation.aggregate({
    where: { customerInvoiceId: invoiceId, payment: { state: "CONFIRMED" } },
    _sum: { amountPaise: true },
  });
  const residualPaise = invoice.totalPaise - (agg._sum.amountPaise ?? 0n);
  await tx.customerInvoice.update({
    where: { id: invoiceId },
    data: { residualPaise, paymentState: badgeFor(invoice.totalPaise, residualPaise) },
  });
}

async function restoreBillResidual(tx: Tx, billId: string) {
  const bill = await tx.vendorBill.findUniqueOrThrow({ where: { id: billId } });
  const agg = await tx.paymentAllocation.aggregate({
    where: { vendorBillId: billId, payment: { state: "CONFIRMED" } },
    _sum: { amountPaise: true },
  });
  const residualPaise = bill.totalPaise - (agg._sum.amountPaise ?? 0n);
  await tx.vendorBill.update({
    where: { id: billId },
    data: { residualPaise, paymentState: badgeFor(bill.totalPaise, residualPaise) },
  });
}

export async function reverseEntry(
  tx: Tx,
  entryId: string,
  opts: { date?: Date; postedById?: string | null } = {},
) {
  const original = await tx.journalEntry.findUnique({
    where: { id: entryId },
    include: {
      items: { orderBy: { lineNo: "asc" } },
      // Needed for the double-reversal guard below: two reversals of one entry
      // would cancel the cancellation and silently restore the balances.
      reversedBy: { select: { id: true } },
    },
  });
  if (!original) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "JournalEntry", entryId });
  if (original.state !== "POSTED") throw new PostingError("NOT_POSTED", { entryId });
  if (original.reversedBy) throw new PostingError("ALREADY_POSTED", { entryId, reason: "already reversed" });

  const lines: PostingLine[] = original.items.map((item) => ({
    accountId: item.accountId,
    partnerId: item.partnerId,
    analyticAccountId: item.analyticAccountId,
    productId: item.productId,
    taxId: item.taxId,
    label: item.label ?? "Reversal",
    // The mirror: debits and credits swapped.
    debitPaise: item.creditPaise,
    creditPaise: item.debitPaise,
  }));

  const entry = await writePostedEntry(tx, {
    name: `R${original.name}`,
    journalId: original.journalId,
    date: opts.date ?? original.date,
    ref: original.ref,
    partnerId: original.partnerId,
    sourceType: "REVERSAL",
    sourceId: original.id,
    lines,
    postedById: opts.postedById,
  });

  await tx.journalEntry.update({
    where: { id: entry.id },
    data: { reversalOfId: original.id },
  });

  // ── Cancel the source document too ──────────────────────────────────────
  //
  // Reversing only the ledger half leaves the books lying to themselves: the
  // Debtors account no longer carries the invoice, but the invoice still sits
  // on the open list demanding payment. The two would disagree, which the
  // "open invoices equal the Debtors control account" check catches on sight.
  //
  // The document keeps its figures. It just stops being OPEN -- and because
  // `invoice_payment_state_correct` ties the badge to the residual, zeroing
  // the residual instead would print "PAID" on a cancelled invoice.
  if (original.sourceId) {
    if (original.sourceType === "CUSTOMER_INVOICE") {
      const settled = await tx.paymentAllocation.count({
        where: { customerInvoiceId: original.sourceId, payment: { state: "CONFIRMED" } },
      });
      // Money has already changed hands against it -- cancel the payment first,
      // or the cash would have nowhere to sit.
      if (settled > 0) throw new PostingError("OVER_ALLOCATION", { reason: "invoice has payments", entryId });
      await tx.customerInvoice.update({ where: { id: original.sourceId }, data: { state: "CANCELLED" } });
    }

    if (original.sourceType === "VENDOR_BILL") {
      const settled = await tx.paymentAllocation.count({
        where: { vendorBillId: original.sourceId, payment: { state: "CONFIRMED" } },
      });
      if (settled > 0) throw new PostingError("OVER_ALLOCATION", { reason: "bill has payments", entryId });
      await tx.vendorBill.update({ where: { id: original.sourceId }, data: { state: "CANCELLED" } });
    }

    // Cancelling a payment gives the money back to the documents it settled,
    // so their residuals have to be recomputed from what is left.
    if (original.sourceType === "PAYMENT") {
      const allocations = await tx.paymentAllocation.findMany({
        where: { paymentId: original.sourceId },
      });
      await tx.paymentAllocation.deleteMany({ where: { paymentId: original.sourceId } });
      await tx.payment.update({
        where: { id: original.sourceId },
        data: { state: "CANCELLED", allocatedPaise: 0n },
      });
      for (const a of allocations) {
        if (a.customerInvoiceId) await restoreInvoiceResidual(tx, a.customerInvoiceId);
        if (a.vendorBillId) await restoreBillResidual(tx, a.vendorBillId);
      }
    }
  }

  return entry;
}

/**
 * The mockup's "Reset to Draft" button. It is not a contradiction of
 * immutability -- it is the same thing Odoo ships. Implemented as an explicit,
 * guarded, logged transition rather than a silent edit, so the trigger still
 * blocks every other route to mutating a posted row.
 */
export async function resetEntryToDraft(
  tx: Tx,
  entryId: string,
  opts: { userId?: string | null; isAdmin: boolean },
) {
  if (!opts.isAdmin) throw new PostingError("NOT_POSTED", { entryId, reason: "admin only" });

  const entry = await tx.journalEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "JournalEntry", entryId });
  if (entry.state !== "POSTED") throw new PostingError("NOT_POSTED", { entryId });

  const company = await tx.companySettings.findUnique({ where: { id: 1 } });
  if (company?.lockDate && atUtcMidnight(entry.date) <= atUtcMidnight(company.lockDate)) {
    throw new PostingError("PERIOD_LOCKED", { entryId });
  }

  // You cannot un-post a document someone has already paid against.
  if (entry.sourceType === "CUSTOMER_INVOICE" && entry.sourceId) {
    const paid = await tx.paymentAllocation.count({ where: { customerInvoiceId: entry.sourceId } });
    if (paid > 0) throw new PostingError("OVER_ALLOCATION", { entryId, reason: "has payments" });
  }
  if (entry.sourceType === "VENDOR_BILL" && entry.sourceId) {
    const paid = await tx.paymentAllocation.count({ where: { vendorBillId: entry.sourceId } });
    if (paid > 0) throw new PostingError("OVER_ALLOCATION", { entryId, reason: "has payments" });
  }

  // Unlatch the database guard for THIS transaction only. Every check above has
  // now passed, and `SET LOCAL` is discarded on commit or rollback, so the
  // escape hatch cannot be left open for the next caller.
  await tx.$executeRawUnsafe(`SET LOCAL app.allow_reset = 'on'`);

  // ORDERING: header first, then items -- the exact reverse of posting, because
  // the trigger reads the parent's state to decide whether the child is frozen.
  await tx.journalEntry.update({ where: { id: entryId }, data: { state: "DRAFT", postedAt: null } });
  await tx.journalItem.updateMany({ where: { entryId }, data: { state: "DRAFT" } });

  await tx.auditLog.create({
    data: {
      action: "RESET_TO_DRAFT",
      model: "JournalEntry",
      recordId: entryId,
      detail: `Entry ${entry.name} reset to draft`,
      userId: opts.userId ?? null,
    },
  });

  return tx.journalEntry.findUnique({ where: { id: entryId } });
}

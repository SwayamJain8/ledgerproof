import type { Tx } from "@/lib/db";
import type { PaymentState } from "@/generated/prisma/enums";
import { PostingError } from "./errors";
import { allocateDocumentNumber, SEQUENCE_CODES } from "./sequence";
import { postCustomerInvoice, postPayment, postVendorBill, type EngineLine } from "./posting";
import { taxOnLinePaise } from "@/lib/money";

/**
 * Document services: the layer between a user pressing Confirm and the posting
 * engine. Everything here runs inside the caller's transaction, so a failed
 * post burns no sequence number and leaves no half-updated document.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Residual and the computed badge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The mockup's status legend, verbatim:
 *   Paid      if amount due = 0
 *   Partial   if amount due < Bill Total
 *   Not Paid  if amount due = Bill Total
 *
 * As written, "Partial" also covers due = 0, but the badges are declared
 * mutually exclusive ("only one at a time"). Ordered evaluation is the only
 * reading that satisfies both statements.
 *
 * The identical branch is compiled into the CHECK constraints
 * `invoice_payment_state_correct` / `bill_payment_state_correct`. Keeping both
 * is not duplication: the constraint is the proof, this is the render path, and
 * a test asserts they agree.
 */
export function paymentStateFor(totalPaise: bigint, residualPaise: bigint): PaymentState {
  if (residualPaise === 0n) return "PAID";
  if (residualPaise === totalPaise) return "NOT_PAID";
  return "PARTIAL";
}

/**
 * Residual is never stored as a fact -- it is recomputed from the allocation
 * table every time an allocation moves. There is no `paid` boolean anywhere in
 * the schema, which is what makes "Partial" real rather than a label.
 */
export async function recomputeInvoiceResidual(tx: Tx, invoiceId: string) {
  const invoice = await tx.customerInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "CustomerInvoice", invoiceId });

  const allocated = await sumConfirmedAllocations(tx, { customerInvoiceId: invoiceId });
  const residualPaise = invoice.totalPaise - allocated;

  return tx.customerInvoice.update({
    where: { id: invoiceId },
    data: {
      residualPaise,
      paymentState: paymentStateFor(invoice.totalPaise, residualPaise),
    },
  });
}

export async function recomputeBillResidual(tx: Tx, billId: string) {
  const bill = await tx.vendorBill.findUnique({ where: { id: billId } });
  if (!bill) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "VendorBill", billId });

  const allocated = await sumConfirmedAllocations(tx, { vendorBillId: billId });
  const residualPaise = bill.totalPaise - allocated;

  return tx.vendorBill.update({
    where: { id: billId },
    data: {
      residualPaise,
      paymentState: paymentStateFor(bill.totalPaise, residualPaise),
    },
  });
}

/**
 * Only CONFIRMED payments count. A draft payment sitting on the screen must not
 * move a residual -- that was one of the bugs the critics caught in the spec.
 */
async function sumConfirmedAllocations(
  tx: Tx,
  where: { customerInvoiceId?: string; vendorBillId?: string },
): Promise<bigint> {
  const allocations = await tx.paymentAllocation.findMany({
    where: { ...where, payment: { state: "CONFIRMED" } },
    select: { amountPaise: true },
  });
  return allocations.reduce((sum, a) => sum + a.amountPaise, 0n);
}

/** "Paid Via Cash" / "Paid Via Bank" -- the mockup's footer block. */
export async function paidByMethod(
  tx: Tx,
  where: { customerInvoiceId?: string; vendorBillId?: string },
): Promise<{ bankPaise: bigint; cashPaise: bigint }> {
  const allocations = await tx.paymentAllocation.findMany({
    where: { ...where, payment: { state: "CONFIRMED" } },
    select: { amountPaise: true, payment: { select: { method: true } } },
  });
  let bankPaise = 0n;
  let cashPaise = 0n;
  for (const a of allocations) {
    if (a.payment.method === "BANK") bankPaise += a.amountPaise;
    else cashPaise += a.amountPaise;
  }
  return { bankPaise, cashPaise };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Totals
// ─────────────────────────────────────────────────────────────────────────────

interface TotalsInput {
  subtotalPaise: bigint;
  taxRateBp: number | null;
}

/**
 * Tax is rounded per line and then summed -- never computed on the document
 * total. Rounding the total instead yields a figure a paisa away from the sum
 * of the displayed line taxes, and then the entry refuses to post.
 */
export function documentTotals(lines: TotalsInput[]) {
  let untaxedPaise = 0n;
  let taxPaise = 0n;
  for (const line of lines) {
    untaxedPaise += line.subtotalPaise;
    if (line.taxRateBp) taxPaise += taxOnLinePaise(line.subtotalPaise, line.taxRateBp);
  }
  return { untaxedPaise, taxPaise, totalPaise: untaxedPaise + taxPaise };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Confirm = allocate number + post + freeze
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Confirming a customer invoice does four things atomically: recompute totals
 * from the lines, allocate the gapless document number, post the balanced
 * journal entry, and set the residual so the badge reads Not Paid.
 */
export async function confirmCustomerInvoice(tx: Tx, invoiceId: string, userId?: string | null) {
  const invoice = await tx.customerInvoice.findUnique({
    where: { id: invoiceId },
    include: { lines: { orderBy: { lineNo: "asc" }, include: { tax: true } } },
  });
  if (!invoice) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "CustomerInvoice", invoiceId });
  if (invoice.state === "POSTED") throw new PostingError("ALREADY_POSTED", { invoiceId });
  if (invoice.lines.length === 0) throw new PostingError("EMPTY_DOCUMENT", { invoiceId });

  const totals = documentTotals(
    invoice.lines.map((l) => ({ subtotalPaise: l.subtotalPaise, taxRateBp: l.tax?.rateBp ?? null })),
  );

  const name = await allocateDocumentNumber(tx, SEQUENCE_CODES.CUSTOMER_INVOICE, invoice.invoiceDate);

  const engineLines: EngineLine[] = invoice.lines.map((l) => ({
    accountId: l.accountId,
    productId: l.productId,
    analyticAccountId: l.analyticAccountId,
    taxId: l.taxId,
    subtotalPaise: l.subtotalPaise,
    label: l.description ?? `Line ${l.lineNo}`,
  }));

  const posted = await postCustomerInvoice(tx, {
    name,
    date: invoice.invoiceDate,
    ref: invoice.invoiceReference,
    customerId: invoice.customerId,
    lines: engineLines,
    sourceId: invoice.id,
    postedById: userId,
  });

  await tx.customerInvoice.update({
    where: { id: invoiceId },
    data: {
      name,
      state: "POSTED",
      journalEntryId: posted.entryId,
      untaxedPaise: totals.untaxedPaise,
      taxPaise: totals.taxPaise,
      totalPaise: totals.totalPaise,
      residualPaise: totals.totalPaise,
      paymentState: paymentStateFor(totals.totalPaise, totals.totalPaise),
    },
  });

  // A partially-invoiced sales order stays open for the rest.
  if (invoice.salesOrderId) {
    await syncSalesOrderState(tx, invoice.salesOrderId);
  }

  return posted;
}

export async function confirmVendorBill(tx: Tx, billId: string, userId?: string | null) {
  const bill = await tx.vendorBill.findUnique({
    where: { id: billId },
    include: { lines: { orderBy: { lineNo: "asc" }, include: { tax: true } } },
  });
  if (!bill) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "VendorBill", billId });
  if (bill.state === "POSTED") throw new PostingError("ALREADY_POSTED", { billId });
  if (bill.lines.length === 0) throw new PostingError("EMPTY_DOCUMENT", { billId });

  const totals = documentTotals(
    bill.lines.map((l) => ({ subtotalPaise: l.subtotalPaise, taxRateBp: l.tax?.rateBp ?? null })),
  );

  const name = await allocateDocumentNumber(tx, SEQUENCE_CODES.VENDOR_BILL, bill.billDate);

  const engineLines: EngineLine[] = bill.lines.map((l) => ({
    accountId: l.accountId,
    productId: l.productId,
    analyticAccountId: l.analyticAccountId,
    taxId: l.taxId,
    subtotalPaise: l.subtotalPaise,
    label: l.description ?? `Line ${l.lineNo}`,
  }));

  const posted = await postVendorBill(tx, {
    name,
    date: bill.billDate,
    ref: bill.billReference,
    vendorId: bill.vendorId,
    lines: engineLines,
    sourceId: bill.id,
    postedById: userId,
  });

  await tx.vendorBill.update({
    where: { id: billId },
    data: {
      name,
      state: "POSTED",
      journalEntryId: posted.entryId,
      untaxedPaise: totals.untaxedPaise,
      taxPaise: totals.taxPaise,
      totalPaise: totals.totalPaise,
      residualPaise: totals.totalPaise,
      paymentState: paymentStateFor(totals.totalPaise, totals.totalPaise),
    },
  });

  if (bill.purchaseOrderId) {
    await syncPurchaseOrderState(tx, bill.purchaseOrderId);
  }

  return posted;
}

export interface AllocationInput {
  customerInvoiceId?: string;
  vendorBillId?: string;
  amountPaise: bigint;
}

/**
 * Confirming a payment posts its own journal entry and then writes one
 * allocation row per document it settles.
 *
 * Payments and documents are many-to-many: one NEFT often clears three
 * invoices, and one invoice often takes four payments. That is why the link
 * carries its own amount.
 */
export async function confirmPayment(
  tx: Tx,
  paymentId: string,
  allocations: AllocationInput[],
  userId?: string | null,
) {
  const payment = await tx.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "Payment", paymentId });
  if (payment.state === "CONFIRMED") throw new PostingError("ALREADY_POSTED", { paymentId });

  const allocatedPaise = allocations.reduce((sum, a) => sum + a.amountPaise, 0n);
  if (allocatedPaise > payment.amountPaise) {
    throw new PostingError("OVER_ALLOCATION", {
      paymentId,
      amountPaise: payment.amountPaise.toString(),
      allocatedPaise: allocatedPaise.toString(),
    });
  }

  const name = await allocateDocumentNumber(tx, SEQUENCE_CODES.PAYMENT, payment.paymentDate);

  const posted = await postPayment(tx, {
    name,
    date: payment.paymentDate,
    ref: payment.note,
    partnerId: payment.partnerId,
    direction: payment.direction,
    journalId: payment.journalId,
    amountPaise: payment.amountPaise,
    sourceId: payment.id,
    postedById: userId,
  });

  await tx.payment.update({
    where: { id: paymentId },
    data: {
      name,
      state: "CONFIRMED",
      journalEntryId: posted.entryId,
      allocatedPaise,
    },
  });

  for (const allocation of allocations) {
    await tx.paymentAllocation.create({
      data: {
        paymentId,
        customerInvoiceId: allocation.customerInvoiceId ?? null,
        vendorBillId: allocation.vendorBillId ?? null,
        amountPaise: allocation.amountPaise,
        createdById: userId ?? null,
      },
    });
  }

  // Recompute AFTER the payment is CONFIRMED, or the sum would exclude it.
  for (const allocation of allocations) {
    if (allocation.customerInvoiceId) await recomputeInvoiceResidual(tx, allocation.customerInvoiceId);
    if (allocation.vendorBillId) await recomputeBillResidual(tx, allocation.vendorBillId);
  }

  return posted;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Order -> document conversion state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A purchase order is BILLED only once every line is fully billed; if some
 * quantity is converted it becomes PARTIALLY_BILLED and stays open for the rest.
 * A team with a one-shot "Convert" button cannot represent this at all.
 */
export async function syncPurchaseOrderState(tx: Tx, orderId: string) {
  const lines = await tx.purchaseOrderLine.findMany({ where: { orderId } });
  if (lines.length === 0) return;

  const allBilled = lines.every((l) => l.qtyBilledMilli >= l.quantityMilli);
  const anyBilled = lines.some((l) => l.qtyBilledMilli > 0n);

  await tx.purchaseOrder.update({
    where: { id: orderId },
    data: { state: allBilled ? "BILLED" : anyBilled ? "PARTIALLY_BILLED" : "CONFIRMED" },
  });
}

export async function syncSalesOrderState(tx: Tx, orderId: string) {
  const lines = await tx.salesOrderLine.findMany({ where: { orderId } });
  if (lines.length === 0) return;

  const allInvoiced = lines.every((l) => l.qtyInvoicedMilli >= l.quantityMilli);
  const anyInvoiced = lines.some((l) => l.qtyInvoicedMilli > 0n);

  await tx.salesOrder.update({
    where: { id: orderId },
    data: { state: allInvoiced ? "BILLED" : anyInvoiced ? "PARTIALLY_BILLED" : "CONFIRMED" },
  });
}

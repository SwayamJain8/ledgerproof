import type { Tx } from "@/lib/db";
import { PostingError } from "./errors";
import { documentTotals } from "./documents";
import { SEQUENCE_CODES, allocateDocumentNumber } from "./sequence";
import { addDays } from "./dates";

/**
 * ORDERS — the commitment layer that sits in front of the ledger.
 *
 * A Purchase Order and a Sales Order post NOTHING. They record intent. The
 * ledger only moves when the resulting bill or invoice is confirmed, which is
 * why none of the functions here touch journal_item.
 *
 * The problem statement's own use-case steps (7.2 and 7.3) are:
 *   PO -> "once the goods are received" -> Vendor Bill -> payment
 *   SO -> Customer Invoice -> payment
 *
 * Conversion copies partner, product, price and quantity forward -- the
 * mockup's words -- and copies only the quantity that has NOT been converted
 * yet. Bill 12 of 20 units and the order stays open showing 8 still billable.
 */

/** Recompute the cached header totals from the lines. */
async function recomputePurchaseOrderTotals(tx: Tx, orderId: string) {
  const lines = await tx.purchaseOrderLine.findMany({
    where: { orderId },
    include: { tax: true },
  });
  const totals = documentTotals(
    lines.map((l) => ({ subtotalPaise: l.subtotalPaise, taxRateBp: l.tax?.rateBp ?? null })),
  );
  await tx.purchaseOrder.update({ where: { id: orderId }, data: totals });
  return totals;
}

async function recomputeSalesOrderTotals(tx: Tx, orderId: string) {
  const lines = await tx.salesOrderLine.findMany({
    where: { orderId },
    include: { tax: true },
  });
  const totals = documentTotals(
    lines.map((l) => ({ subtotalPaise: l.subtotalPaise, taxRateBp: l.tax?.rateBp ?? null })),
  );
  await tx.salesOrder.update({ where: { id: orderId }, data: totals });
  return totals;
}

/**
 * Confirm a purchase order: allocate "PO0001" and open it for billing.
 *
 * The number is allocated here rather than at draft creation for the same
 * reason it is on bills and invoices -- numbering a draft the user then
 * abandons leaves a permanent hole in the sequence.
 */
export async function confirmPurchaseOrder(tx: Tx, orderId: string) {
  const order = await tx.purchaseOrder.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });
  if (!order) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "PurchaseOrder", orderId });
  if (order.state !== "DRAFT") throw new PostingError("ALREADY_POSTED", { orderId });
  if (order.lines.length === 0) throw new PostingError("EMPTY_DOCUMENT", { orderId });

  const name = await allocateDocumentNumber(tx, SEQUENCE_CODES.PURCHASE_ORDER, order.orderDate);
  await recomputePurchaseOrderTotals(tx, orderId);
  await tx.purchaseOrder.update({
    where: { id: orderId },
    data: { name, state: "CONFIRMED" },
  });
  return name;
}

export async function confirmSalesOrder(tx: Tx, orderId: string) {
  const order = await tx.salesOrder.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });
  if (!order) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "SalesOrder", orderId });
  if (order.state !== "DRAFT") throw new PostingError("ALREADY_POSTED", { orderId });
  if (order.lines.length === 0) throw new PostingError("EMPTY_DOCUMENT", { orderId });

  const name = await allocateDocumentNumber(tx, SEQUENCE_CODES.SALES_ORDER, order.orderDate);
  await recomputeSalesOrderTotals(tx, orderId);
  await tx.salesOrder.update({
    where: { id: orderId },
    data: { name, state: "CONFIRMED" },
  });
  return name;
}

/**
 * PO -> draft Vendor Bill.
 *
 * Carries forward vendor, product, price and quantity, and links each bill line
 * back to the order line it came from. Only the UNBILLED remainder is copied,
 * so calling this twice on a partially billed order bills the rest.
 *
 * The bill is created as a DRAFT: it has no number and posts nothing until the
 * user confirms it. That keeps "goods received" and "ledger moved" as two
 * separate, deliberate acts.
 */
export async function createBillFromPurchaseOrder(
  tx: Tx,
  orderId: string,
  opts: { billDate: Date; dueDate?: Date; billReference?: string | null },
) {
  const order = await tx.purchaseOrder.findUnique({
    where: { id: orderId },
    include: { lines: { orderBy: { lineNo: "asc" } } },
  });
  if (!order) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "PurchaseOrder", orderId });
  if (order.state === "DRAFT") {
    throw new PostingError("ORDER_NOT_CONFIRMED", { orderId });
  }

  // Only what is still outstanding.
  const remaining = order.lines
    .map((line) => ({ line, qty: line.quantityMilli - line.qtyBilledMilli }))
    .filter((r) => r.qty > 0n);

  if (remaining.length === 0) {
    throw new PostingError("NOTHING_TO_BILL", { orderId });
  }

  const billLines = remaining.map((r, index) => {
    // Unit price is unchanged, so the subtotal scales with the remaining qty.
    const subtotalPaise = (r.qty * r.line.unitPricePaise) / 1000n;
    return {
      lineNo: index + 1,
      productId: r.line.productId,
      description: r.line.description,
      analyticAccountId: r.line.analyticAccountId,
      quantityMilli: r.qty,
      unitPricePaise: r.line.unitPricePaise,
      taxId: r.line.taxId,
      subtotalPaise,
      purchaseOrderLineId: r.line.id,
    };
  });

  const taxes = await tx.tax.findMany();
  const totals = documentTotals(
    billLines.map((l) => ({
      subtotalPaise: l.subtotalPaise,
      taxRateBp: l.taxId ? (taxes.find((t) => t.id === l.taxId)?.rateBp ?? null) : null,
    })),
  );

  const dueDate = opts.dueDate ?? addDays(opts.billDate, 30);

  return tx.vendorBill.create({
    data: {
      name: `DRAFT-BILL-${order.id}-${order.lines.length}-${Date.now().toString(36)}`,
      purchaseOrderId: order.id,
      vendorId: order.vendorId,
      billReference: opts.billReference ?? null,
      billDate: opts.billDate,
      dueDate,
      untaxedPaise: totals.untaxedPaise,
      taxPaise: totals.taxPaise,
      totalPaise: totals.totalPaise,
      residualPaise: totals.totalPaise,
      paymentState: totals.totalPaise === 0n ? "PAID" : "NOT_PAID",
      lines: { create: billLines },
    },
  });
}

/** SO -> draft Customer Invoice. Mirror image of the purchase side. */
export async function createInvoiceFromSalesOrder(
  tx: Tx,
  orderId: string,
  opts: { invoiceDate: Date; dueDate?: Date; invoiceReference?: string | null },
) {
  const order = await tx.salesOrder.findUnique({
    where: { id: orderId },
    include: { lines: { orderBy: { lineNo: "asc" } } },
  });
  if (!order) throw new PostingError("DOCUMENT_NOT_FOUND", { what: "SalesOrder", orderId });
  if (order.state === "DRAFT") {
    throw new PostingError("ORDER_NOT_CONFIRMED", { orderId });
  }

  const remaining = order.lines
    .map((line) => ({ line, qty: line.quantityMilli - line.qtyInvoicedMilli }))
    .filter((r) => r.qty > 0n);

  if (remaining.length === 0) {
    throw new PostingError("NOTHING_TO_INVOICE", { orderId });
  }

  const invoiceLines = remaining.map((r, index) => {
    const subtotalPaise = (r.qty * r.line.unitPricePaise) / 1000n;
    return {
      lineNo: index + 1,
      productId: r.line.productId,
      description: r.line.description,
      analyticAccountId: r.line.analyticAccountId,
      quantityMilli: r.qty,
      unitPricePaise: r.line.unitPricePaise,
      taxId: r.line.taxId,
      subtotalPaise,
      salesOrderLineId: r.line.id,
    };
  });

  const taxes = await tx.tax.findMany();
  const totals = documentTotals(
    invoiceLines.map((l) => ({
      subtotalPaise: l.subtotalPaise,
      taxRateBp: l.taxId ? (taxes.find((t) => t.id === l.taxId)?.rateBp ?? null) : null,
    })),
  );

  const dueDate = opts.dueDate ?? addDays(opts.invoiceDate, 30);

  return tx.customerInvoice.create({
    data: {
      name: `DRAFT-INV-${order.id}-${order.lines.length}-${Date.now().toString(36)}`,
      salesOrderId: order.id,
      customerId: order.customerId,
      invoiceReference: opts.invoiceReference ?? null,
      invoiceDate: opts.invoiceDate,
      dueDate,
      untaxedPaise: totals.untaxedPaise,
      taxPaise: totals.taxPaise,
      totalPaise: totals.totalPaise,
      residualPaise: totals.totalPaise,
      paymentState: totals.totalPaise === 0n ? "PAID" : "NOT_PAID",
      lines: { create: invoiceLines },
    },
  });
}

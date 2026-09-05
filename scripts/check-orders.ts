/**
 * End-to-end check of the order -> document conversion flow.
 *
 * This exercises the problem statement's own use-case steps 7.2 and 7.3:
 *   PO -> confirm -> partial bill -> confirm -> remainder bill
 *   SO -> confirm -> invoice -> confirm
 *
 * It writes real documents, so re-seed afterwards to restore the demo books:
 *   npm run seed
 */
import "dotenv/config";

import { prisma, type Tx } from "../src/lib/db";
import { accountingDate } from "../src/lib/accounting/dates";
import {
  confirmPurchaseOrder,
  confirmSalesOrder,
  createBillFromPurchaseOrder,
  createInvoiceFromSalesOrder,
} from "../src/lib/accounting/orders";
import { confirmCustomerInvoice, confirmVendorBill } from "../src/lib/accounting/documents";
import { formatINR } from "../src/lib/money";

let failures = 0;
const ok = (label: string, detail = "") =>
  console.log(`  \x1b[32mPASS\x1b[0m  ${label}${detail ? `  ${detail}` : ""}`);
const bad = (label: string, detail: string) => {
  failures += 1;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${label}  ${detail}`);
};
const eq = <T>(label: string, actual: T, expected: T) =>
  actual === expected ? ok(label, String(actual)) : bad(label, `expected ${expected}, got ${actual}`);

async function main() {
  const vendor = await prisma.contact.findFirstOrThrow({ where: { type: { in: ["VENDOR", "BOTH"] } } });
  const customer = await prisma.contact.findFirstOrThrow({ where: { type: { in: ["CUSTOMER", "BOTH"] } } });
  const product = await prisma.product.findFirstOrThrow({ where: { name: "Office Chair" } });
  const gst = await prisma.tax.findFirst({ where: { rateBp: 1800 } });
  const date = accountingDate("2026-09-15");

  console.log("\n\x1b[1mPurchase: PO -> partial bill -> remainder\x1b[0m");

  // 20 units ordered at Rs 1,200.
  const po = await prisma.purchaseOrder.create({
    data: {
      name: `DRAFT-PO-check-${Date.now().toString(36)}`,
      vendorId: vendor.id,
      orderDate: date,
      lines: {
        create: [
          {
            lineNo: 1,
            productId: product.id,
            quantityMilli: 20_000n,
            unitPricePaise: 120_000n,
            taxId: gst?.id ?? null,
            subtotalPaise: 2_400_000n,
          },
        ],
      },
    },
  });

  const poName = await prisma.$transaction((tx) => confirmPurchaseOrder(tx as Tx, po.id));
  eq("PO number allocated with no year segment", /^PO\d{4}$/.test(poName), true);

  // Bill only 12 of the 20 units, by editing the draft the conversion produced.
  const bill1 = await prisma.$transaction(async (tx) => {
    const draft = await createBillFromPurchaseOrder(tx as Tx, po.id, { billDate: date });
    const line = await tx.vendorBillLine.findFirstOrThrow({ where: { billId: draft.id } });
    await tx.vendorBillLine.update({
      where: { id: line.id },
      data: { quantityMilli: 12_000n, subtotalPaise: 1_440_000n },
    });
    return draft;
  });

  const billLine = await prisma.vendorBillLine.findFirstOrThrow({ where: { billId: bill1.id } });
  eq("Bill line links back to its PO line", billLine.purchaseOrderLineId !== null, true);
  eq("Vendor carried forward", bill1.vendorId, vendor.id);

  await prisma.$transaction((tx) => confirmVendorBill(tx as Tx, bill1.id));

  const poAfter1 = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: po.id },
    include: { lines: true },
  });
  eq("Order is PARTIALLY_BILLED after billing 12 of 20", poAfter1.state, "PARTIALLY_BILLED");
  eq("Billed quantity rolled up to the order line", poAfter1.lines[0].qtyBilledMilli, 12_000n);

  // The remainder should be exactly the 8 unbilled units.
  const bill2 = await prisma.$transaction((tx) =>
    createBillFromPurchaseOrder(tx as Tx, po.id, { billDate: date }),
  );
  const bill2Line = await prisma.vendorBillLine.findFirstOrThrow({ where: { billId: bill2.id } });
  eq("Second bill carries only the 8 remaining units", bill2Line.quantityMilli, 8_000n);

  await prisma.$transaction((tx) => confirmVendorBill(tx as Tx, bill2.id));
  const poAfter2 = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
  eq("Order is BILLED once fully converted", poAfter2.state, "BILLED");

  // A third conversion must refuse rather than silently duplicate.
  let refused = false;
  try {
    await prisma.$transaction((tx) => createBillFromPurchaseOrder(tx as Tx, po.id, { billDate: date }));
  } catch {
    refused = true;
  }
  eq("Billing a fully-billed order is refused", refused, true);

  console.log("\n\x1b[1mSales: SO -> invoice\x1b[0m");

  const so = await prisma.salesOrder.create({
    data: {
      name: `DRAFT-SO-check-${Date.now().toString(36)}`,
      customerId: customer.id,
      orderDate: date,
      lines: {
        create: [
          {
            lineNo: 1,
            productId: product.id,
            quantityMilli: 5_000n,
            unitPricePaise: 250_000n,
            taxId: gst?.id ?? null,
            subtotalPaise: 1_250_000n,
          },
        ],
      },
    },
  });

  const soName = await prisma.$transaction((tx) => confirmSalesOrder(tx as Tx, so.id));
  eq("SO number allocated with no year segment", /^SO\d{4}$/.test(soName), true);

  const inv = await prisma.$transaction((tx) =>
    createInvoiceFromSalesOrder(tx as Tx, so.id, { invoiceDate: date }),
  );
  eq("Customer carried forward", inv.customerId, customer.id);
  eq("Invoice total includes GST", inv.totalPaise, 1_475_000n);

  await prisma.$transaction((tx) => confirmCustomerInvoice(tx as Tx, inv.id));
  const soAfter = await prisma.salesOrder.findUniqueOrThrow({
    where: { id: so.id },
    include: { lines: true },
  });
  eq("Order is BILLED once fully invoiced", soAfter.state, "BILLED");
  eq("Invoiced quantity rolled up", soAfter.lines[0].qtyInvoicedMilli, 5_000n);

  const posted = await prisma.customerInvoice.findUniqueOrThrow({ where: { id: inv.id } });
  eq("Invoice number allocated at confirm", /^INV\/\d{4}\/\d{4}$/.test(posted.name), true);
  ok("Invoice residual", formatINR(posted.residualPaise));

  console.log(
    failures === 0
      ? "\n\x1b[32mAll order-conversion checks passed.\x1b[0m\n"
      : `\n\x1b[31m${failures} check(s) FAILED.\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());

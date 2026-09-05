/**
 * Full reconciliation round-trip against the database.
 *
 * Imports the demo statement, settles every confident line, and then proves the
 * books still tie -- because the whole claim of this feature is that it FINDS
 * payments rather than inventing a second way to post them.
 *
 * Writes real payments. Re-seed afterwards: npm run seed
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { prisma, type Tx } from "../src/lib/db";
import { formatINR } from "../src/lib/money";
import { confirmPayment } from "../src/lib/accounting/documents";
import { parseBankStatementCsv } from "../src/lib/reconciliation/csv";
import { matchStatement, type OpenDocument } from "../src/lib/reconciliation/matcher";
import { trialBalance } from "../src/lib/reports/ledger";
import { balanceSheet } from "../src/lib/reports/balance-sheet";
import { today } from "../src/lib/app-context";

let failures = 0;
const ok = (l: string, d = "") => console.log(`  \x1b[32mPASS\x1b[0m  ${l}${d ? `  ${d}` : ""}`);
const bad = (l: string, d: string) => {
  failures += 1;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${l}  ${d}`);
};

async function openDocs(): Promise<OpenDocument[]> {
  const [inv, bills] = await Promise.all([
    prisma.customerInvoice.findMany({
      where: { state: "POSTED", residualPaise: { gt: 0 } },
      include: { customer: { select: { name: true } } },
    }),
    prisma.vendorBill.findMany({
      where: { state: "POSTED", residualPaise: { gt: 0 } },
      include: { vendor: { select: { name: true } } },
    }),
  ]);
  return [
    ...inv.map((i) => ({
      id: i.id, kind: "INVOICE" as const, name: i.name,
      partnerName: i.customer.name, residualPaise: i.residualPaise, date: i.invoiceDate,
    })),
    ...bills.map((b) => ({
      id: b.id, kind: "BILL" as const, name: b.name,
      partnerName: b.vendor.name, residualPaise: b.residualPaise, date: b.billDate,
    })),
  ];
}

async function main() {
  const asOf = today();
  const before = await balanceSheet(prisma, { asOf, fiscalYearStartMonth: 4 });

  console.log("\n\x1b[1mImport\x1b[0m");
  const { rows, errors } = parseBankStatementCsv(
    readFileSync("demo/bank_statement_aug2026.csv", "utf8"),
  );
  errors.forEach((e) => console.log("  note: " + e));
  ok("Parsed statement rows", String(rows.length));

  await prisma.bankStatementLine.deleteMany({ where: { state: "UNMATCHED" } });
  await prisma.bankStatementLine.createMany({
    data: rows.map((r) => ({ ...r, state: "UNMATCHED" })),
  });

  console.log("\n\x1b[1mSettle every confident line\x1b[0m");
  // What the matcher believes it can clear on its own, computed before we
  // settle anything. Asserting against this rather than a hard-coded count
  // keeps the script honest when the seed data changes.
  const predicted = matchStatement(
    (await prisma.bankStatementLine.findMany({ where: { state: "UNMATCHED" } })).map((l) => ({
      id: l.id,
      date: l.date,
      narration: l.narration,
      amountPaise: l.amountPaise,
    })),
    await openDocs(),
  ).filter((m) => m.autoMatch).length;

  let settled = 0;
  let receivedPaise = 0n;
  let paidOutPaise = 0n;

  for (let pass = 0; pass < 50; pass += 1) {
    const lines = await prisma.bankStatementLine.findMany({ where: { state: "UNMATCHED" } });
    const matches = matchStatement(
      lines.map((l) => ({ id: l.id, date: l.date, narration: l.narration, amountPaise: l.amountPaise })),
      await openDocs(),
    );
    const next = matches.find((m) => m.autoMatch);
    if (!next?.autoMatch) break;

    const line = next.line;
    const doc = next.autoMatch.document;
    const isReceipt = line.amountPaise >= 0n;
    const amountPaise = isReceipt ? line.amountPaise : -line.amountPaise;
    const allocate = amountPaise > doc.residualPaise ? doc.residualPaise : amountPaise;

    const journal = await prisma.journal.findFirstOrThrow({ where: { type: "BANK" } });
    const document = isReceipt
      ? await prisma.customerInvoice.findUniqueOrThrow({ where: { id: doc.id } })
      : await prisma.vendorBill.findUniqueOrThrow({ where: { id: doc.id } });
    const partnerId = isReceipt
      ? (document as { customerId: string }).customerId
      : (document as { vendorId: string }).vendorId;

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          name: `DRAFT-PAY-e2e-${Date.now().toString(36)}-${settled}`,
          direction: isReceipt ? "RECEIVE" : "SEND",
          partnerId,
          paymentDate: line.date,
          method: "BANK",
          journalId: journal.id,
          amountPaise,
          note: `Bank statement: ${line.narration}`,
        },
      });
      await confirmPayment(
        tx as Tx,
        payment.id,
        [{
          customerInvoiceId: isReceipt ? doc.id : undefined,
          vendorBillId: isReceipt ? undefined : doc.id,
          amountPaise: allocate,
        }],
        null,
      );
      await tx.bankStatementLine.update({
        where: { id: line.id },
        data: { state: "MATCHED", matchedPaymentId: payment.id, confidence: next.autoMatch!.confidence },
      });
    });

    console.log(`  settled ${doc.name.padEnd(15)} ${formatINR(amountPaise).padStart(15)}  at ${next.autoMatch.confidence}%`);
    settled += 1;
    if (isReceipt) receivedPaise += allocate;
    else paidOutPaise += allocate;
  }

  if (settled === predicted) ok("Settled exactly what the matcher predicted", String(settled));
  else bad("Settled a different number than predicted", `predicted ${predicted}, settled ${settled}`);
  if (settled === 0) bad("Nothing was confident enough to settle", "the statement or the seed has drifted");

  console.log("\n\x1b[1mThe books after reconciling\x1b[0m");
  const tb = await trialBalance(prisma, asOf);
  if (tb.balanced) ok("Trial balance is still zero", formatINR(tb.differencePaise));
  else bad("Trial balance drifted", formatINR(tb.differencePaise));

  const after = await balanceSheet(prisma, { asOf, fiscalYearStartMonth: 4 });
  if (after.balanced) ok("Balance sheet still balances", formatINR(after.totalAssetsPaise));
  else bad("Balance sheet no longer balances", formatINR(after.differencePaise));

  // Settling a RECEIVABLE just moves money from Debtors to Bank, so assets are
  // unchanged. Settling a PAYABLE spends real money: Bank falls and Creditors
  // fall by the same amount. So the only legitimate change in total assets is
  // exactly what we paid out -- anything else means the reconciler invented money.
  const expectedAssets = before.totalAssetsPaise - paidOutPaise;
  if (after.totalAssetsPaise === expectedAssets) {
    ok(
      `Assets moved by exactly what we paid out (${formatINR(receivedPaise)} received, ${formatINR(paidOutPaise)} paid)`,
      formatINR(after.totalAssetsPaise),
    );
  } else {
    bad(
      "Assets did not move by the amount paid out",
      `expected ${formatINR(expectedAssets)}, got ${formatINR(after.totalAssetsPaise)}`,
    );
  }

  const liabilityDrop = before.totalLiabilitiesPaise - after.totalLiabilitiesPaise;
  if (liabilityDrop === paidOutPaise) {
    ok("Creditors fell by exactly what we paid them", formatINR(liabilityDrop));
  } else {
    bad(
      "Liability movement does not match payments",
      `expected ${formatINR(paidOutPaise)}, got ${formatINR(liabilityDrop)}`,
    );
  }

  const unmatched = await prisma.bankStatementLine.count({ where: { state: "UNMATCHED" } });
  ok("Lines left for a human", String(unmatched));

  console.log(
    failures === 0
      ? "\n\x1b[32mReconciliation round-trip passed.\x1b[0m Re-seed to restore the demo books.\n"
      : `\n\x1b[31m${failures} check(s) FAILED.\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());

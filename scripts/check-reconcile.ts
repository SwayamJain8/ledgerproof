/**
 * Dry-run the reconciliation matcher against the demo statement.
 *
 * Reads only — it scores and prints, it settles nothing. Use it to confirm the
 * demo CSV produces the intended mix of confident and ambiguous lines before
 * standing up in front of anyone.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { prisma } from "../src/lib/db";
import { formatINR } from "../src/lib/money";
import { parseBankStatementCsv } from "../src/lib/reconciliation/csv";
import { matchStatement, type OpenDocument } from "../src/lib/reconciliation/matcher";

async function main() {
  const path = process.argv[2] ?? "demo/bank_statement_aug2026.csv";
  const { rows, errors } = parseBankStatementCsv(readFileSync(path, "utf8"));

  if (errors.length) {
    console.log("\x1b[33mParse warnings:\x1b[0m");
    errors.forEach((e) => console.log("  " + e));
  }

  const [invoices, bills] = await Promise.all([
    prisma.customerInvoice.findMany({
      where: { state: "POSTED", residualPaise: { gt: 0 } },
      include: { customer: { select: { name: true } } },
    }),
    prisma.vendorBill.findMany({
      where: { state: "POSTED", residualPaise: { gt: 0 } },
      include: { vendor: { select: { name: true } } },
    }),
  ]);

  const documents: OpenDocument[] = [
    ...invoices.map((i) => ({
      id: i.id,
      kind: "INVOICE" as const,
      name: i.name,
      partnerName: i.customer.name,
      residualPaise: i.residualPaise,
      date: i.invoiceDate,
    })),
    ...bills.map((b) => ({
      id: b.id,
      kind: "BILL" as const,
      name: b.name,
      partnerName: b.vendor.name,
      residualPaise: b.residualPaise,
      date: b.billDate,
    })),
  ];

  const matches = matchStatement(
    rows.map((r, i) => ({ id: `L${i + 1}`, ...r })),
    documents,
  );

  let auto = 0;
  let manual = 0;
  let none = 0;

  console.log(`\n\x1b[1m${path} — ${rows.length} lines against ${documents.length} open documents\x1b[0m\n`);

  for (const m of matches) {
    const best = m.autoMatch ?? m.candidates[0];
    const tag = m.autoMatch
      ? "\x1b[32mAUTO  \x1b[0m"
      : best
        ? "\x1b[33mDECIDE\x1b[0m"
        : "\x1b[90mNONE  \x1b[0m";
    if (m.autoMatch) auto += 1;
    else if (best) manual += 1;
    else none += 1;

    console.log(`${tag} ${formatINR(m.line.amountPaise).padStart(16)}  ${m.line.narration}`);
    if (best) {
      console.log(
        `        -> ${best.document.name} (${best.document.partnerName}) at ${best.confidence}%`,
      );
      best.signals.forEach((s) => console.log(`           +${String(s.points).padStart(2)}  ${s.label}`));
      if (m.candidates[1]) {
        console.log(
          `           runner-up ${m.candidates[1].document.name} at ${m.candidates[1].confidence}%`,
        );
      }
    }
    console.log("");
  }

  console.log(
    `\x1b[1mSummary\x1b[0m  ${auto} auto-clear, ${manual} need a decision, ${none} match nothing\n`,
  );
}

main().finally(() => prisma.$disconnect());

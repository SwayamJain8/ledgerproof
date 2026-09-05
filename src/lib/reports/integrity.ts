import type { Tx } from "@/lib/db";
import { paymentStateFor } from "@/lib/accounting/documents";
import { verifyChain } from "@/lib/accounting/chain";
import { accountBalances, trialBalance } from "./ledger";
import { balanceSheet } from "./balance-sheet";
import { profitAndLoss } from "./profit-loss";
import { currentFiscalYear } from "@/lib/app-context";

/**
 * The invariants, checked live against the database.
 *
 * These are the same assertions `npm run audit` makes, exposed in the UI so
 * nobody has to run a script to believe them. Each check re-derives its figure
 * independently -- several of them compute the same number by two different
 * routes and compare, which is the only kind of check that catches a subledger
 * that has quietly drifted from the ledger.
 */

export interface IntegrityCheck {
  id: string;
  group: string;
  title: string;
  /** What failure would mean, in plain terms. */
  rationale: string;
  passed: boolean;
  evidence: string;
}

export interface IntegrityReport {
  checks: IntegrityCheck[];
  passed: number;
  failed: number;
}

const inr = (paise: bigint) => {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const rupees = (abs / 100n).toString();
  const fraction = (abs % 100n).toString().padStart(2, "0");
  const grouped =
    rupees.length <= 3
      ? rupees
      : rupees.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + rupees.slice(-3);
  return `${negative ? "-" : ""}Rs. ${grouped}.${fraction}`;
};

export async function runIntegrityChecks(tx: Tx, asOf: Date): Promise<IntegrityReport> {
  const checks: IntegrityCheck[] = [];
  const add = (check: IntegrityCheck) => checks.push(check);

  // ── 1. The ledger itself ────────────────────────────────────────────────
  const tb = await trialBalance(tx, asOf);
  add({
    id: "trial-balance",
    group: "The ledger",
    title: "Total debits equal total credits",
    rationale:
      "The single assertion the whole system rests on. If these two differ, no report below is meaningful.",
    passed: tb.balanced,
    evidence: `${inr(tb.debitPaise)} debit against ${inr(tb.creditPaise)} credit, across ${tb.itemCount} items in ${tb.entryCount} entries.`,
  });

  const unbalanced = await tx.$queryRaw<{ name: string }[]>`
    SELECT e.name FROM journal_entry e JOIN journal_item i ON i.entry_id = e.id
     WHERE e.state = 'POSTED'
     GROUP BY e.id, e.name
    HAVING SUM(i.debit_paise) <> SUM(i.credit_paise)
  `;
  add({
    id: "per-entry",
    group: "The ledger",
    title: "Every posted entry balances on its own",
    rationale:
      "Checked per entry, not just in aggregate -- two offsetting broken entries would slip past a total.",
    passed: unbalanced.length === 0,
    evidence:
      unbalanced.length === 0
        ? "No unbalanced entry exists."
        : `Unbalanced: ${unbalanced.map((r) => r.name).join(", ")}`,
  });

  const malformed = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM journal_item
     WHERE debit_paise < 0 OR credit_paise < 0
        OR (debit_paise <> 0 AND credit_paise <> 0)
  `;
  add({
    id: "one-sided",
    group: "The ledger",
    title: "No journal item is negative or two-sided",
    rationale:
      "A negative debit is a credit in disguise, and it makes every report's sign handling wrong in a way that is nearly impossible to trace.",
    passed: Number(malformed[0].n) === 0,
    evidence: `${Number(malformed[0].n)} malformed items. Enforced by CHECK journal_item_one_sided.`,
  });

  const denorm = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
      FROM journal_item i JOIN journal_entry e ON e.id = i.entry_id
     WHERE i.state <> e.state OR i.date <> e.date OR i.journal_id <> e.journal_id
  `;
  add({
    id: "denormalisation",
    group: "The ledger",
    title: "Denormalised item columns agree with their entry",
    rationale:
      "Every report reads journal_item without joining upward. That shortcut is only safe while the copied date, state and journal stay true.",
    passed: Number(denorm[0].n) === 0,
    evidence: `${Number(denorm[0].n)} items disagree with their header.`,
  });

  // ── 2. Nothing bypassed the engine ──────────────────────────────────────
  const [invoicesNoEntry, billsNoEntry, paymentsNoEntry] = await Promise.all([
    tx.customerInvoice.count({ where: { state: "POSTED", journalEntryId: null } }),
    tx.vendorBill.count({ where: { state: "POSTED", journalEntryId: null } }),
    tx.payment.count({ where: { state: "CONFIRMED", journalEntryId: null } }),
  ]);
  const orphaned = invoicesNoEntry + billsNoEntry + paymentsNoEntry;
  add({
    id: "documents-posted",
    group: "The posting engine",
    title: "Every posted document owns a journal entry",
    rationale:
      "A confirmed document with no entry would show on its own list as real while contributing nothing to the books.",
    passed: orphaned === 0,
    evidence: `${invoicesNoEntry} invoices, ${billsNoEntry} bills and ${paymentsNoEntry} payments are missing an entry.`,
  });

  const untraced = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM journal_entry
     WHERE state = 'POSTED'
       AND source_type IN ('CUSTOMER_INVOICE', 'VENDOR_BILL', 'PAYMENT')
       AND posting_trace IS NULL
  `;
  add({
    id: "traced",
    group: "The posting engine",
    title: "Every document entry carries a resolution trace",
    rationale:
      "The trace records which configuration rung produced each account. Without it, the claim that accounts are resolved rather than hardcoded is unverifiable.",
    passed: Number(untraced[0].n) === 0,
    evidence: `${Number(untraced[0].n)} entries lack a trace.`,
  });

  // ── 3. Subledger ties to ledger ─────────────────────────────────────────
  const balances = await accountBalances(tx, { to: asOf });
  const bySubtype = (subtype: string) =>
    balances.filter((b) => b.subtype === subtype).reduce((s, b) => s + b.balancePaise, 0n);

  const invoices = await tx.customerInvoice.findMany({
    where: { state: "POSTED" },
    include: { allocations: { include: { payment: { select: { state: true } } } } },
  });
  const openInvoices = invoices.reduce((s, i) => s + i.residualPaise, 0n);
  const debtors = bySubtype("RECEIVABLE");
  add({
    id: "debtors-tie",
    group: "Subledger vs ledger",
    title: "Open invoices equal the Debtors control account",
    rationale:
      "The documents and the ledger arrive at this figure by completely separate routes. This is the check that catches a faked subledger.",
    passed: openInvoices === debtors,
    evidence: `Invoices outstanding ${inr(openInvoices)} against Debtors ${inr(debtors)}.`,
  });

  const bills = await tx.vendorBill.findMany({ where: { state: "POSTED" } });
  const openBills = bills.reduce((s, b) => s + b.residualPaise, 0n);
  const creditors = bySubtype("PAYABLE");
  add({
    id: "creditors-tie",
    group: "Subledger vs ledger",
    title: "Open bills equal the Creditors control account",
    rationale: "The same test, on the purchase side.",
    passed: openBills === creditors,
    evidence: `Bills outstanding ${inr(openBills)} against Creditors ${inr(creditors)}.`,
  });

  let residualDrift = 0;
  let badgeDrift = 0;
  for (const invoice of invoices) {
    const allocated = invoice.allocations
      .filter((a) => a.payment.state === "CONFIRMED")
      .reduce((s, a) => s + a.amountPaise, 0n);
    const expected = invoice.totalPaise - allocated;
    if (invoice.residualPaise !== expected) residualDrift += 1;
    if (invoice.paymentState !== paymentStateFor(invoice.totalPaise, expected)) badgeDrift += 1;
  }
  add({
    id: "residuals",
    group: "Subledger vs ledger",
    title: "Residuals are derived, not stored opinions",
    rationale:
      "Residual is recomputed as total minus confirmed allocations. There is no paid flag anywhere that could drift out of sync.",
    passed: residualDrift === 0 && badgeDrift === 0,
    evidence: `${residualDrift} residuals and ${badgeDrift} payment badges disagree with the allocation table.`,
  });

  // ── 4. Reports agree with each other ────────────────────────────────────
  const fy = currentFiscalYear();
  const [bs, pl] = await Promise.all([
    balanceSheet(tx, { asOf, fiscalYearStartMonth: 4 }),
    profitAndLoss(tx, { from: fy.start, to: asOf }),
  ]);
  add({
    id: "balance-sheet",
    group: "Reports",
    title: "Assets equal Liabilities plus Capital",
    rationale: "The accounting equation, closed without a plug figure.",
    passed: bs.balanced,
    evidence: `${inr(bs.totalAssetsPaise)} against ${inr(bs.totalLiabilitiesPaise)}, difference ${inr(bs.differencePaise)}.`,
  });

  const cye = bs.liabilities.find((row) => row.label.toLowerCase().includes("current year"));
  add({
    id: "pl-bs-agree",
    group: "Reports",
    title: "The P&L and the Balance Sheet agree on profit",
    rationale:
      "Two reports computed separately from the same ledger. If they disagree, one of them is inventing a number.",
    passed: (cye?.amountPaise ?? -1n) === pl.netIncomePaise,
    evidence: `P&L net income ${inr(pl.netIncomePaise)} against Balance Sheet current year earnings ${inr(cye?.amountPaise ?? 0n)}.`,
  });

  // ── The tamper-evident seal ─────────────────────────────────────────────
  const chain = await verifyChain(tx);
  add({
    id: "chain-intact",
    group: "Tamper evidence",
    title: "The hash chain is unbroken",
    rationale:
      "Each posted entry is sealed with sha256(previous hash + its own contents), so every entry commits to the whole history before it. Editing one row in the database — with the application bypassed entirely — breaks every hash from that row onwards.",
    passed: chain.valid,
    evidence: chain.valid
      ? `${chain.checked} entries re-hashed and every seal matched.`
      : `Chain breaks at entry #${chain.brokenAt?.chainIndex} (${chain.brokenAt?.name}): ${
          chain.brokenAt?.reason === "HASH_MISMATCH" ? "its contents no longer match its seal" : "it does not link to the entry before it"
        }.`,
  });
  add({
    id: "chain-complete",
    group: "Tamper evidence",
    title: "Every posted entry is sealed",
    rationale:
      "An entry with no seal is an entry outside the chain, which is exactly where someone would try to hide one.",
    passed: chain.unsealed === 0,
    evidence: `${chain.unsealed} posted entries carry no hash.`,
  });

  return {
    checks,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length,
  };
}

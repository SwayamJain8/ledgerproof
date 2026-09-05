import type { Tx } from "@/lib/db";
import { accountBalances, BEGINNING_OF_TIME, type AccountBalance } from "./ledger";
import { BALANCE_SHEET_TYPES } from "@/lib/accounting/account-type";
import { currentYearEarnings, retainedEarnings } from "./profit-loss";

/**
 * Balance Sheet — a photograph of the business at ONE instant.
 *
 * Because it is literally `f(T) = aggregate(journal_item WHERE date <= T)`,
 * changing T re-derives the whole report. That is what makes the as-of-date
 * slider possible, and it is impossible on document-summed reports because
 * there is nowhere for opening balances or manual entries to live.
 *
 * Account-type mapping, verbatim from the mockup's arrow note:
 *   Bank      -> Account type Asset - Bank
 *   Cash      -> Account type Asset - cash
 *   Debtors   -> Account type Asset - Debtors
 *   Creditors -> Account type Liability - creditor
 *   Capital   -> Account Type Capital
 *
 * "Debtors" and "Creditor" are not leaves in the mockup's own type dropdown,
 * which is its one genuine ambiguity. We keep the eight leaf types exactly as
 * drawn and pin those two rows with `subtype`, so renaming an account can never
 * break a report.
 */

export interface BSRow {
  label: string;
  amountPaise: bigint;
  accounts: AccountBalance[];
  /** True for rows the reporting engine computes rather than reads. */
  derived?: boolean;
}

export interface BalanceSheet {
  asOf: Date;
  assets: BSRow[];
  totalAssetsPaise: bigint;
  liabilities: BSRow[];
  totalLiabilitiesPaise: bigint;
  /** Zero when the books are sound. Printed on the Books Integrity page. */
  differencePaise: bigint;
  balanced: boolean;
}

export async function balanceSheet(
  tx: Tx,
  opts: { asOf: Date; fiscalYearStartMonth?: number },
): Promise<BalanceSheet> {
  const fiscalYearStartMonth = opts.fiscalYearStartMonth ?? 4;

  const balances = await accountBalances(tx, {
    from: BEGINNING_OF_TIME,
    to: opts.asOf,
    types: BALANCE_SHEET_TYPES,
  });

  const pick = (predicate: (b: AccountBalance) => boolean) => balances.filter(predicate);
  const total = (rows: AccountBalance[]) => rows.reduce((sum, r) => sum + r.balancePaise, 0n);
  const row = (label: string, rows: AccountBalance[]): BSRow => ({
    label,
    amountPaise: total(rows),
    accounts: rows,
  });

  // ── Assets, in the order the mockup draws them ──
  const bank = pick((b) => b.type === "BANK");
  const cash = pick((b) => b.type === "CASH");
  const debtors = pick((b) => b.type === "ASSET" && b.subtype === "RECEIVABLE");
  const otherAssets = pick((b) => b.type === "ASSET" && b.subtype !== "RECEIVABLE");

  const assets: BSRow[] = [row("Bank", bank), row("Cash", cash), row("Debtors", debtors)];
  if (otherAssets.length > 0) assets.push(row("Other Assets", otherAssets));

  // ── Liabilities and equity ──
  const creditors = pick((b) => b.type === "LIABILITY" && b.subtype === "PAYABLE");
  const otherLiabilities = pick((b) => b.type === "LIABILITY" && b.subtype !== "PAYABLE");
  const capital = pick(
    (b) =>
      b.type === "CAPITAL" &&
      b.subtype !== "RETAINED_EARNINGS" &&
      b.subtype !== "CURRENT_YEAR_EARNINGS",
  );

  const liabilities: BSRow[] = [row("Capital", capital), row("Creditors", creditors)];
  if (otherLiabilities.length > 0) liabilities.push(row("Other Liabilities", otherLiabilities));

  /**
   * The row that makes the two totals actually tie.
   *
   * Every rupee of profit sits in Assets (as bank, or as money customers owe
   * us) but has no matching entry on the other side until it is pushed onto
   * equity. No journal item is ever posted to this account during the year --
   * it is derived, which is why it is labelled as such.
   */
  const cyePaise = await currentYearEarnings(tx, opts.asOf, fiscalYearStartMonth);
  const retainedPaise = await retainedEarnings(tx, opts.asOf, fiscalYearStartMonth);

  if (retainedPaise !== 0n) {
    liabilities.push({ label: "Retained Earnings", amountPaise: retainedPaise, accounts: [], derived: true });
  }
  liabilities.push({
    label: "Current Year Earnings",
    amountPaise: cyePaise,
    accounts: [],
    derived: true,
  });

  const totalAssetsPaise = assets.reduce((sum, r) => sum + r.amountPaise, 0n);
  const totalLiabilitiesPaise = liabilities.reduce((sum, r) => sum + r.amountPaise, 0n);

  return {
    asOf: opts.asOf,
    assets,
    totalAssetsPaise,
    liabilities,
    totalLiabilitiesPaise,
    differencePaise: totalAssetsPaise - totalLiabilitiesPaise,
    balanced: totalAssetsPaise === totalLiabilitiesPaise,
  };
}

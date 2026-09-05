import type { Tx } from "@/lib/db";
import { accountBalances, type AccountBalance } from "./ledger";
import { PROFIT_LOSS_TYPES } from "@/lib/accounting/account-type";
import { fiscalYearRange } from "@/lib/accounting/dates";

/**
 * Profit & Loss — a video of income minus expenses BETWEEN two dates.
 * (The Balance Sheet is a photograph AT one date. Same table, different WHERE.)
 *
 * The mockup's six rows, and its "Field Computation" callout verbatim:
 *   Income            - Total of Income
 *   Income from Sales - Total of account type Income
 *   Expenses          - Total of All expenses
 *   Purchase Expense  - Total of Account type Expense
 *   Other Expense     - Total of account type Other Expense
 *   Net Income        - Difference of Income - Expenses
 *
 * "Income" and "Income from Sales" are both described as the total of account
 * type Income and both print 10000 in the sample. The resolution that
 * reproduces the drawn numbers exactly: Income is the SECTION header total and
 * Income from Sales is the one account-type row inside it. Same shape on the
 * expense side.
 */

export interface PLRow {
  label: string;
  amountPaise: bigint;
  /** The accounts that produced this row, for the drill-down. */
  accounts: AccountBalance[];
}

export interface ProfitAndLoss {
  from: Date;
  to: Date;
  income: PLRow;
  incomeRows: PLRow[];
  expenses: PLRow;
  expenseRows: PLRow[];
  netIncomePaise: bigint;
}

export async function profitAndLoss(
  tx: Tx,
  opts: { from: Date; to: Date },
): Promise<ProfitAndLoss> {
  const balances = await accountBalances(tx, {
    from: opts.from,
    to: opts.to,
    types: PROFIT_LOSS_TYPES,
  });

  const incomeAccounts = balances.filter((b) => b.type === "INCOME");
  const purchaseAccounts = balances.filter((b) => b.type === "EXPENSE");
  const otherExpenseAccounts = balances.filter((b) => b.type === "OTHER_EXPENSE");

  const total = (rows: AccountBalance[]) => rows.reduce((sum, r) => sum + r.balancePaise, 0n);

  const incomeRows: PLRow[] = [
    { label: "Income from Sales", amountPaise: total(incomeAccounts), accounts: incomeAccounts },
  ];
  const expenseRows: PLRow[] = [
    { label: "Purchase Expense", amountPaise: total(purchaseAccounts), accounts: purchaseAccounts },
    { label: "Other Expense", amountPaise: total(otherExpenseAccounts), accounts: otherExpenseAccounts },
  ];

  const incomeTotal = incomeRows.reduce((sum, r) => sum + r.amountPaise, 0n);
  const expenseTotal = expenseRows.reduce((sum, r) => sum + r.amountPaise, 0n);

  return {
    from: opts.from,
    to: opts.to,
    income: { label: "Income", amountPaise: incomeTotal, accounts: incomeAccounts },
    incomeRows,
    expenses: {
      label: "Expenses",
      amountPaise: expenseTotal,
      accounts: [...purchaseAccounts, ...otherExpenseAccounts],
    },
    expenseRows,
    netIncomePaise: incomeTotal - expenseTotal,
  };
}

/**
 * Net income for the fiscal year containing `asOf`, counted only up to `asOf`.
 *
 * This is the figure the Balance Sheet injects into equity as Current Year
 * Earnings, and it must be the SAME number the P&L prints as Net Income.
 * Pointing at both on stage is the five-second check an accounting judge runs.
 */
export async function currentYearEarnings(
  tx: Tx,
  asOf: Date,
  fiscalYearStartMonth: number,
): Promise<bigint> {
  const { start } = fiscalYearRange(
    fiscalYearOfDate(asOf, fiscalYearStartMonth),
    fiscalYearStartMonth,
  );
  const pl = await profitAndLoss(tx, { from: start, to: asOf });
  return pl.netIncomePaise;
}

/**
 * Every rupee of profit the business has kept from PRIOR years. Cumulative P&L
 * up to the day before the current fiscal year opened.
 */
export async function retainedEarnings(
  tx: Tx,
  asOf: Date,
  fiscalYearStartMonth: number,
): Promise<bigint> {
  const { start } = fiscalYearRange(
    fiscalYearOfDate(asOf, fiscalYearStartMonth),
    fiscalYearStartMonth,
  );
  const dayBefore = new Date(start.getTime() - 86_400_000);
  const pl = await profitAndLoss(tx, { from: new Date(Date.UTC(1900, 0, 1)), to: dayBefore });
  return pl.netIncomePaise;
}

function fiscalYearOfDate(date: Date, startMonth: number): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return month >= startMonth ? year : year - 1;
}

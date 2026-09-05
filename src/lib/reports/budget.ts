import type { Tx } from "@/lib/db";
import type { AnalyticType } from "@/generated/prisma/enums";

/**
 * Budget actuals.
 *
 * The mockup's own field-explanation box describes the calculation as:
 *   "Search Analytical in Sales Invoice with name Project 1, consider budget
 *    period and compute total and set in achieved amount"
 *
 * That is a description of the fake — summing the invoice table. We compute the
 * identical number from journal_item instead. Same answer for invoice-driven
 * spend, but ours also catches a manual journal entry tagged to Project 1, and
 * it stays correct after a reversal. Following the spec literally would have
 * made the feature wrong; following its intent makes it right.
 *
 * The direction is fixed and stated twice in the drawing:
 *   analytics on invoice lines      -> type INCOME
 *   analytics on PO / bill lines    -> type EXPENSE
 * So income achievement comes only from income accounts and expense achievement
 * only from expense accounts.
 */

export interface BudgetLineActuals {
  budgetLineId: string;
  analyticAccountId: string;
  analyticName: string;
  type: AnalyticType;
  committedPaise: bigint;
  achievedPaise: bigint;
  /** (achieved / committed) * 100, as the mockup's formula states. */
  achievedPercent: number;
  /** committed - achieved */
  amountToAchievePaise: bigint;
}

export interface BudgetActuals {
  budgetId: string;
  name: string;
  state: string;
  startDate: Date;
  endDate: Date;
  lines: BudgetLineActuals[];
  totalCommittedPaise: bigint;
  totalAchievedPaise: bigint;
}

/**
 * Sum posted journal items tagged with one analytic account, inside a period,
 * restricted to the account types that side of the budget cares about.
 */
export async function achievedForAnalytic(
  tx: Tx,
  opts: { analyticAccountId: string; type: AnalyticType; from: Date; to: Date },
): Promise<bigint> {
  const types = opts.type === "INCOME" ? ["INCOME"] : ["EXPENSE", "OTHER_EXPENSE"];

  const rows = await tx.$queryRaw<{ debit: bigint; credit: bigint }[]>`
    SELECT COALESCE(SUM(ji.debit_paise),  0)::bigint AS debit,
           COALESCE(SUM(ji.credit_paise), 0)::bigint AS credit
      FROM journal_item ji
      JOIN account a ON a.id = ji.account_id
     WHERE ji.state = 'POSTED'
       AND ji.analytic_account_id = ${opts.analyticAccountId}
       AND ji.date >= ${opts.from}::date
       AND ji.date <= ${opts.to}::date
       AND a.type::text = ANY(${types}::text[])
  `;

  const row = rows[0] ?? { debit: 0n, credit: 0n };
  const debit = BigInt(row.debit);
  const credit = BigInt(row.credit);

  // Income grows on the credit side, expense on the debit side.
  return opts.type === "INCOME" ? credit - debit : debit - credit;
}

export async function budgetActuals(tx: Tx, budgetId: string): Promise<BudgetActuals> {
  const budget = await tx.budget.findUnique({
    where: { id: budgetId },
    include: { lines: { include: { analyticAccount: true } } },
  });
  if (!budget) throw new Error(`Budget ${budgetId} not found`);

  const lines: BudgetLineActuals[] = [];
  for (const line of budget.lines) {
    const achievedPaise = await achievedForAnalytic(tx, {
      analyticAccountId: line.analyticAccountId,
      type: line.type,
      from: budget.startDate,
      to: budget.endDate,
    });

    lines.push({
      budgetLineId: line.id,
      analyticAccountId: line.analyticAccountId,
      analyticName: line.analyticAccount.name,
      type: line.type,
      committedPaise: line.committedPaise,
      achievedPaise,
      achievedPercent: percentOf(achievedPaise, line.committedPaise),
      amountToAchievePaise: line.committedPaise - achievedPaise,
    });
  }

  return {
    budgetId: budget.id,
    name: budget.name,
    state: budget.state,
    startDate: budget.startDate,
    endDate: budget.endDate,
    lines,
    totalCommittedPaise: lines.reduce((s, l) => s + l.committedPaise, 0n),
    totalAchievedPaise: lines.reduce((s, l) => s + l.achievedPaise, 0n),
  };
}

/** Guarded against the divide-by-zero a committed amount of 0 would cause. */
export function percentOf(achievedPaise: bigint, committedPaise: bigint): number {
  if (committedPaise === 0n) return 0;
  return Number((achievedPaise * 10_000n) / committedPaise) / 100;
}

/**
 * The NON-BLOCKING over-budget warning, wired to two separate hook points:
 * PO confirm and Bill confirm. The drawing shows the identical note twice.
 *
 * It is a warning, not a block -- the user must still be able to proceed.
 * (Contrast with the debit-vs-credit rule, which is drawn in red and IS a block.)
 */
export const OVER_BUDGET_WARNING = {
  title: "Exceeds Approved Budget",
  message:
    "The entered amount is higher than the remaining budget amount for this budget line. " +
    "Consider adjusting the value or revise the budget.",
} as const;

export interface BudgetWarning {
  analyticAccountId: string;
  analyticName: string;
  budgetName: string;
  remainingPaise: bigint;
  documentPaise: bigint;
  title: string;
  message: string;
}

/**
 * Check a document's analytic tags against any confirmed budget covering its
 * date. Returns the warnings to show; it never throws, because blocking here
 * would contradict the drawing.
 */
export async function checkOverBudget(
  tx: Tx,
  opts: {
    documentDate: Date;
    lines: { analyticAccountId: string | null; subtotalPaise: bigint }[];
  },
): Promise<BudgetWarning[]> {
  const byAnalytic = new Map<string, bigint>();
  for (const line of opts.lines) {
    if (!line.analyticAccountId) continue;
    byAnalytic.set(
      line.analyticAccountId,
      (byAnalytic.get(line.analyticAccountId) ?? 0n) + line.subtotalPaise,
    );
  }
  if (byAnalytic.size === 0) return [];

  const warnings: BudgetWarning[] = [];

  for (const [analyticAccountId, documentPaise] of byAnalytic) {
    const budgetLine = await tx.budgetLine.findFirst({
      where: {
        analyticAccountId,
        budget: {
          state: "CONFIRMED",
          active: true,
          startDate: { lte: opts.documentDate },
          endDate: { gte: opts.documentDate },
        },
      },
      include: { budget: true, analyticAccount: true },
    });
    if (!budgetLine) continue;

    const achievedPaise = await achievedForAnalytic(tx, {
      analyticAccountId,
      type: budgetLine.type,
      from: budgetLine.budget.startDate,
      to: budgetLine.budget.endDate,
    });

    const remainingPaise = budgetLine.committedPaise - achievedPaise;
    if (documentPaise > remainingPaise) {
      warnings.push({
        analyticAccountId,
        analyticName: budgetLine.analyticAccount.name,
        budgetName: budgetLine.budget.name,
        remainingPaise,
        documentPaise,
        ...OVER_BUDGET_WARNING,
      });
    }
  }

  return warnings;
}

/**
 * The drill-down behind the clickable Achieved Amount: "list view of all
 * Invoices/Bills having same analytical for the budget period".
 */
export async function achievedDrilldown(
  tx: Tx,
  opts: { analyticAccountId: string; type: AnalyticType; from: Date; to: Date },
) {
  const types = opts.type === "INCOME" ? ["INCOME"] : ["EXPENSE", "OTHER_EXPENSE"];
  return tx.journalItem.findMany({
    where: {
      state: "POSTED",
      analyticAccountId: opts.analyticAccountId,
      date: { gte: opts.from, lte: opts.to },
      account: { type: { in: types as never } },
    },
    orderBy: [{ date: "asc" }],
    include: {
      entry: { select: { name: true, sourceType: true, sourceId: true } },
      account: { select: { code: true, name: true, type: true } },
      partner: { select: { name: true } },
    },
  });
}

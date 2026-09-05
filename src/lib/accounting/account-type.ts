/**
 * The account-type taxonomy. This is the routing key for every report.
 *
 * The mockup's blue annotation next to the Chart of Accounts type dropdown says
 * exactly why the field exists:
 *
 *   "Each account is assigned an Account Type, which would further be used for
 *    how the account is to be treated and where it appears in reports."
 *
 * So reports group on `account.type`. They never match an account NAME. Rename
 * "Sales Income A/c" to "Revenue A/c" and the P&L does not care.
 */

import type { AccountType } from "@/generated/prisma/enums";

export type ReportSection = "BALANCE_SHEET" | "PROFIT_LOSS";
export type BalanceSide = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE";
export type NormalBalance = "DEBIT" | "CREDIT";

export interface AccountTypeMeta {
  /** Which of the two reports this type appears in. The split is disjoint. */
  section: ReportSection;
  /** Which column of that report. */
  side: BalanceSide;
  /**
   * Which direction makes the number grow. Bank, Cash, Debtors and Expenses
   * grow when debited; Creditors, Capital and Income grow when credited.
   * The report uses this so a Rs 40,000 sale prints as +40,000, not -40,000.
   */
  normal: NormalBalance;
  /** The label the mockup's grouped dropdown shows. */
  label: string;
  /** The non-selectable heading this leaf sits under. */
  group: "Balancesheet" | "Profit and Loss";
}

export const ACCOUNT_TYPE_META: Record<AccountType, AccountTypeMeta> = {
  ASSET: { section: "BALANCE_SHEET", side: "ASSET", normal: "DEBIT", label: "Asset", group: "Balancesheet" },
  LIABILITY: { section: "BALANCE_SHEET", side: "LIABILITY", normal: "CREDIT", label: "Liability", group: "Balancesheet" },
  BANK: { section: "BALANCE_SHEET", side: "ASSET", normal: "DEBIT", label: "Bank", group: "Balancesheet" },
  CAPITAL: { section: "BALANCE_SHEET", side: "LIABILITY", normal: "CREDIT", label: "Capital", group: "Balancesheet" },
  CASH: { section: "BALANCE_SHEET", side: "ASSET", normal: "DEBIT", label: "Cash", group: "Balancesheet" },
  INCOME: { section: "PROFIT_LOSS", side: "INCOME", normal: "CREDIT", label: "Income", group: "Profit and Loss" },
  EXPENSE: { section: "PROFIT_LOSS", side: "EXPENSE", normal: "DEBIT", label: "Expenses", group: "Profit and Loss" },
  OTHER_EXPENSE: { section: "PROFIT_LOSS", side: "EXPENSE", normal: "DEBIT", label: "Other Expenses", group: "Profit and Loss" },
};

/** The five types the Balance Sheet aggregates cumulatively up to a date. */
export const BALANCE_SHEET_TYPES = (Object.keys(ACCOUNT_TYPE_META) as AccountType[]).filter(
  (t) => ACCOUNT_TYPE_META[t].section === "BALANCE_SHEET",
);

/** The three types the P&L aggregates between two dates. */
export const PROFIT_LOSS_TYPES = (Object.keys(ACCOUNT_TYPE_META) as AccountType[]).filter(
  (t) => ACCOUNT_TYPE_META[t].section === "PROFIT_LOSS",
);

/**
 * Signed balance in the direction that reads as positive for this type.
 *
 * Debit-normal:  debit - credit
 * Credit-normal: credit - debit
 */
export function signedBalance(type: AccountType, debitPaise: bigint, creditPaise: bigint): bigint {
  return ACCOUNT_TYPE_META[type].normal === "DEBIT"
    ? debitPaise - creditPaise
    : creditPaise - debitPaise;
}

/**
 * The mockup's grouped dropdown, with the two headings marked non-selectable.
 * "Just for heading selection can be done from the orange part only."
 */
export const ACCOUNT_TYPE_GROUPS: { heading: string; options: { value: AccountType; label: string }[] }[] = [
  {
    heading: "Balancesheet",
    options: (["ASSET", "LIABILITY", "BANK", "CAPITAL", "CASH"] as AccountType[]).map((value) => ({
      value,
      label: ACCOUNT_TYPE_META[value].label,
    })),
  },
  {
    heading: "Profit and Loss",
    options: (["INCOME", "EXPENSE", "OTHER_EXPENSE"] as AccountType[]).map((value) => ({
      value,
      label: ACCOUNT_TYPE_META[value].label,
    })),
  },
];

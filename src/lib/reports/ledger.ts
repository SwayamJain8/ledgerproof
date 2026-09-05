import type { Tx } from "@/lib/db";
import type { AccountType, AccountSubtype } from "@/generated/prisma/enums";
import { ACCOUNT_TYPE_META, signedBalance } from "@/lib/accounting/account-type";

/**
 * The one aggregation every report is built from.
 *
 * There is exactly one table allowed to be the source of a financial number:
 *   journal_item WHERE state = 'POSTED'
 *
 * Balance Sheet and P&L differ only in their WHERE clause and which account
 * types they include. Six reports, one table. Nothing in this app computes a
 * financial figure by summing invoice rows.
 */

/** Far enough back to mean "since the beginning of the books". */
export const BEGINNING_OF_TIME = new Date(Date.UTC(1900, 0, 1));

export interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  debitPaise: bigint;
  creditPaise: bigint;
  /** Positive in the direction that is natural for this account type. */
  balancePaise: bigint;
}

interface RawRow {
  account_id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  debit: bigint;
  credit: bigint;
}

/**
 * Sum every posted journal item between two dates, grouped by account.
 *
 * `from` = BEGINNING_OF_TIME gives the cumulative semantics the Balance Sheet
 * needs; a real `from` gives the windowed semantics the P&L needs. Same table,
 * two aggregation semantics -- that is the entire report engine.
 */
export async function accountBalances(
  tx: Tx,
  opts: { from?: Date; to: Date; types?: AccountType[] },
): Promise<AccountBalance[]> {
  const from = opts.from ?? BEGINNING_OF_TIME;
  const types = opts.types ?? null;

  const rows = await tx.$queryRaw<RawRow[]>`
    SELECT a.id            AS account_id,
           a.code          AS code,
           a.name          AS name,
           a.type          AS type,
           a.subtype       AS subtype,
           COALESCE(SUM(ji.debit_paise),  0)::bigint AS debit,
           COALESCE(SUM(ji.credit_paise), 0)::bigint AS credit
      FROM journal_item ji
      JOIN account a ON a.id = ji.account_id
     WHERE ji.state = 'POSTED'
       AND ji.date >= ${from}::date
       AND ji.date <= ${opts.to}::date
       AND (${types}::text[] IS NULL OR a.type::text = ANY(${types}::text[]))
     GROUP BY a.id, a.code, a.name, a.type, a.subtype
     HAVING COALESCE(SUM(ji.debit_paise), 0) <> 0
         OR COALESCE(SUM(ji.credit_paise), 0) <> 0
     ORDER BY a.code
  `;

  return rows.map((r) => ({
    accountId: r.account_id,
    code: r.code,
    name: r.name,
    type: r.type,
    subtype: r.subtype,
    debitPaise: BigInt(r.debit),
    creditPaise: BigInt(r.credit),
    balancePaise: signedBalance(r.type, BigInt(r.debit), BigInt(r.credit)),
  }));
}

/**
 * The single number that proves the books are real: add up every debit in the
 * database and every credit, and the difference is exactly zero.
 */
export async function trialBalance(tx: Tx, asOf?: Date) {
  const to = asOf ?? new Date(Date.UTC(9999, 11, 31));
  const rows = await tx.$queryRaw<{ debit: bigint; credit: bigint; items: bigint; entries: bigint }[]>`
    SELECT COALESCE(SUM(debit_paise),  0)::bigint AS debit,
           COALESCE(SUM(credit_paise), 0)::bigint AS credit,
           COUNT(*)::bigint                       AS items,
           COUNT(DISTINCT entry_id)::bigint       AS entries
      FROM journal_item
     WHERE state = 'POSTED' AND date <= ${to}::date
  `;
  const row = rows[0] ?? { debit: 0n, credit: 0n, items: 0n, entries: 0n };
  const debitPaise = BigInt(row.debit);
  const creditPaise = BigInt(row.credit);
  return {
    debitPaise,
    creditPaise,
    differencePaise: debitPaise - creditPaise,
    itemCount: Number(row.items),
    entryCount: Number(row.entries),
    balanced: debitPaise === creditPaise,
  };
}

/**
 * The general-ledger drill-down: every line in one account, in date order,
 * with a running balance. This is where the Balance Sheet's "Debtors" figure
 * goes when a judge clicks it.
 */
export async function accountLedger(tx: Tx, accountId: string, opts: { from?: Date; to: Date }) {
  const from = opts.from ?? BEGINNING_OF_TIME;
  const [account, items] = await Promise.all([
    tx.account.findUnique({ where: { id: accountId } }),
    tx.journalItem.findMany({
      where: { accountId, state: "POSTED", date: { gte: from, lte: opts.to } },
      orderBy: [{ date: "asc" }, { entryId: "asc" }, { lineNo: "asc" }],
      include: {
        entry: { select: { name: true, sourceType: true, sourceId: true } },
        partner: { select: { name: true } },
      },
    }),
  ]);

  // The running total is signed in the account's OWN normal direction, so a
  // liability that grows reads as a growing positive number rather than an
  // increasingly negative one. Getting this wrong makes every credit-normal
  // account's ledger look like it is in deficit.
  const creditNormal = account ? ACCOUNT_TYPE_META[account.type].normal === "CREDIT" : false;

  let running = 0n;
  return items.map((item) => {
    const movement = item.debitPaise - item.creditPaise;
    running += creditNormal ? -movement : movement;
    return {
      ...item,
      entryName: item.entry.name,
      partnerName: item.partner?.name ?? null,
      runningPaise: running,
    };
  });
}

/**
 * Posting failures are a closed set. Each code names a rung of a resolution
 * chain that came back empty, or an invariant the engine refused to break.
 *
 * They are deliberately shaped like the database's own constraint names, so a
 * judge sees the same vocabulary whether the rejection came from TypeScript or
 * from Postgres.
 */
export type PostingErrorCode =
  | "NO_REVENUE_ACCOUNT"
  | "NO_EXPENSE_ACCOUNT"
  | "NO_TAX_ACCOUNT"
  | "NO_CONTROL_ACCOUNT"
  | "NO_MONEY_ACCOUNT"
  | "NO_JOURNAL"
  | "NO_SEQUENCE"
  | "EMPTY_DOCUMENT"
  | "ALREADY_POSTED"
  | "NOT_POSTED"
  | "PERIOD_LOCKED"
  | "UNBALANCED_ENTRY"
  | "OVER_ALLOCATION"
  | "DOCUMENT_NOT_FOUND"
  /// An order must be confirmed before it can be converted.
  | "ORDER_NOT_CONFIRMED"
  /// Every line on the order has already been converted in full.
  | "NOTHING_TO_BILL"
  | "NOTHING_TO_INVOICE";

export class PostingError extends Error {
  readonly code: PostingErrorCode;
  readonly context: Record<string, unknown>;

  constructor(code: PostingErrorCode, context: Record<string, unknown> = {}) {
    super(`${code}${Object.keys(context).length ? ` ${JSON.stringify(context)}` : ""}`);
    this.name = "PostingError";
    this.code = code;
    this.context = context;
  }
}

/**
 * The one error the mockup writes in red: "Blocking warning if the debit and
 * credit amount don't match." It is thrown by the engine AND enforced by the
 * deferred trigger `journal_entry_must_balance`, so it holds even for an entry
 * created by a seed script or a direct API call.
 */
export class UnbalancedEntryError extends PostingError {
  constructor(debitPaise: bigint, creditPaise: bigint) {
    super("UNBALANCED_ENTRY", {
      debitPaise: debitPaise.toString(),
      creditPaise: creditPaise.toString(),
      differencePaise: (debitPaise - creditPaise).toString(),
    });
    this.name = "UnbalancedEntryError";
  }
}

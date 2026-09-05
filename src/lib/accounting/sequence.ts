import type { Tx } from "@/lib/db";
import { PostingError } from "./errors";
import { sequenceYearOf } from "./dates";

/**
 * Gapless, per-year, concurrency-safe document numbering.
 *
 * The mockup says "(auto generate Invoice Number +1 of Last Bill)" and shows
 * INV/2026/0001, Bill/2026/0001, PO0001. A database auto-increment id satisfies
 * none of that: it is global, it leaks how many documents exist, and it gaps on
 * every rolled-back transaction.
 */

export const SEQUENCE_CODES = {
  CUSTOMER_INVOICE: "customer_invoice",
  VENDOR_BILL: "vendor_bill",
  PURCHASE_ORDER: "purchase_order",
  SALES_ORDER: "sales_order",
  PAYMENT: "payment",
  MANUAL_ENTRY: "manual_entry",
} as const;

export type SequenceCode = (typeof SEQUENCE_CODES)[keyof typeof SEQUENCE_CODES];

/**
 * Allocate the next number for a document kind, inside the caller's transaction.
 *
 * The single `UPDATE ... RETURNING` takes a row lock, so two simultaneous posts
 * serialise here and can never receive the same number. Because it runs in the
 * posting transaction, a failed post rolls the counter back with everything else.
 *
 * Call this at POST time, not at draft creation: numbering a draft that the user
 * then abandons leaves a permanent hole, and a hole is the first thing an
 * auditor asks about.
 */
export async function allocateDocumentNumber(
  tx: Tx,
  code: SequenceCode,
  documentDate: Date,
): Promise<string> {
  const year = sequenceYearOf(documentDate);

  const rows = await tx.$queryRaw<
    { prefix: string; allocated: number; padding: number; use_year: boolean }[]
  >`
    UPDATE sequence
       SET next_number = next_number + 1
     WHERE code = ${code} AND fiscal_year = ${year}
    RETURNING prefix, next_number - 1 AS allocated, padding, use_year
  `;

  const row = rows[0];
  if (!row) {
    throw new PostingError("NO_SEQUENCE", { code, year });
  }

  return formatDocumentNumber(row.prefix, year, row.allocated, row.padding, row.use_year);
}

/**
 * "INV/" + 2026 + 1 -> "INV/2026/0001"
 * "PO"  + 2026 + 1 -> "PO0001"   (the mockup draws PO and SO with no year)
 */
export function formatDocumentNumber(
  prefix: string,
  year: number,
  number: number,
  padding: number,
  useYear: boolean,
): string {
  const counter = String(number).padStart(padding, "0");
  return useYear ? `${prefix}${year}/${counter}` : `${prefix}${counter}`;
}

/**
 * Peek without consuming. For showing "next number will be ..." in the UI only
 * -- never use this to write a document number.
 */
export async function peekDocumentNumber(
  tx: Tx,
  code: SequenceCode,
  documentDate: Date,
): Promise<string | null> {
  const year = sequenceYearOf(documentDate);
  const sequence = await tx.sequence.findUnique({
    where: { code_fiscalYear: { code, fiscalYear: year } },
  });
  if (!sequence) return null;
  return formatDocumentNumber(
    sequence.prefix,
    year,
    sequence.nextNumber,
    sequence.padding,
    sequence.useYear,
  );
}

/**
 * A draft document needs a placeholder in its unique `name` column until it is
 * posted. Odoo shows "Draft Invoice (*)" for exactly the same reason.
 */
export function draftPlaceholderName(code: SequenceCode, id: string): string {
  return `DRAFT-${code}-${id}`;
}

export function isDraftPlaceholder(name: string): boolean {
  return name.startsWith("DRAFT-");
}

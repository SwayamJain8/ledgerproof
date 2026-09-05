import { rupeesToPaise } from "@/lib/money";
import { accountingDate } from "@/lib/accounting/dates";

/**
 * Bank statement CSV parsing.
 *
 * Real bank exports are inconsistent, so this is forgiving about column names
 * and date formats but strict about the result: a row either produces a valid
 * line or a named error. Silently dropping a row would make the reconciliation
 * total wrong in a way nobody would notice.
 *
 * Accepted shapes:
 *   Date, Narration, Amount            (signed: negative = money out)
 *   Date, Narration, Debit, Credit     (two-column, as most Indian banks export)
 */

export interface ParsedStatementRow {
  date: Date;
  narration: string;
  /** Positive = money into our bank. */
  amountPaise: bigint;
}

export interface CsvParseResult {
  rows: ParsedStatementRow[];
  errors: string[];
}

/** Split a CSV line, honouring double-quoted fields that contain commas. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** "15/09/2026", "15-09-2026" and "2026-09-15" all mean the same day. */
export function parseStatementDate(raw: string): Date | null {
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return accountingDate(text);

  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return accountingDate(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
  }
  return null;
}

/** "1,69,920.00" and "(500.00)" both parse; the second is negative. */
export function parseAmount(raw: string): bigint | null {
  let text = raw.trim().replace(/[₹\s]/g, "").replace(/,/g, "");
  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;

  const paise = rupeesToPaise(text);
  return negative ? -paise : paise;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export function parseBankStatementCsv(content: string): CsvParseResult {
  const errors: string[] = [];
  const rows: ParsedStatementRow[] = [];

  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { rows, errors: ["The file is empty."] };

  const header = splitCsvLine(lines[0]).map(norm);
  const findCol = (...names: string[]) => header.findIndex((h) => names.includes(h));

  const dateCol = findCol("date", "txndate", "transactiondate", "valuedate");
  const narrCol = findCol("narration", "description", "particulars", "details", "remarks");
  const amtCol = findCol("amount", "amt");
  const debitCol = findCol("debit", "withdrawal", "withdrawalamt");
  const creditCol = findCol("credit", "deposit", "depositamt");

  if (dateCol === -1) errors.push("No Date column found.");
  if (narrCol === -1) errors.push("No Narration/Description column found.");
  if (amtCol === -1 && (debitCol === -1 || creditCol === -1)) {
    errors.push("No Amount column, and no Debit/Credit pair either.");
  }
  if (errors.length > 0) return { rows, errors };

  lines.slice(1).forEach((raw, index) => {
    const rowNo = index + 2; // 1-based, and the header is row 1.
    const cells = splitCsvLine(raw);

    const date = parseStatementDate(cells[dateCol] ?? "");
    if (!date) {
      errors.push(`Row ${rowNo}: could not read the date "${cells[dateCol] ?? ""}".`);
      return;
    }

    const narration = (cells[narrCol] ?? "").trim();
    if (!narration) {
      errors.push(`Row ${rowNo}: the narration is empty.`);
      return;
    }

    let amountPaise: bigint | null = null;
    if (amtCol !== -1) {
      amountPaise = parseAmount(cells[amtCol] ?? "");
    } else {
      const debit = parseAmount(cells[debitCol] ?? "") ?? 0n;
      const credit = parseAmount(cells[creditCol] ?? "") ?? 0n;
      // Money out is negative in our convention.
      amountPaise = credit - debit;
    }

    if (amountPaise === null) {
      errors.push(`Row ${rowNo}: could not read the amount.`);
      return;
    }
    if (amountPaise === 0n) {
      errors.push(`Row ${rowNo}: the amount is zero.`);
      return;
    }

    rows.push({ date, narration, amountPaise });
  });

  return { rows, errors };
}

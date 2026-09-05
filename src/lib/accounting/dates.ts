/**
 * An accounting date has no time zone.
 *
 * "2026-09-02" in Mumbai and "2026-09-02" in the database must be the same day,
 * or the September P&L silently swallows an invoice dated 31-August. Every
 * `date` column is stored at UTC midnight and is never produced by `new Date()`.
 *
 * `createdAt` / `postedAt` are real timestamps and mean something different:
 * when the row was written, not when the transaction happened.
 */

/** "2026-09-15" -> Date at 2026-09-15T00:00:00.000Z */
export function accountingDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    throw new Error(`accountingDate: expected YYYY-MM-DD, got "${iso}"`);
  }
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

/** Date -> "2026-09-15", reading UTC parts so the local zone cannot shift it. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Strip any time component, keeping the UTC calendar day. */
export function atUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * The year segment of a document number.
 *
 * Deliberately the CALENDAR year, not the fiscal year. The mockup shows
 * "Bill/2026/0001" and "INV/2026/0001", and an invoice dated 10-Jan-2026
 * printing "INV/2025/0009" because India's fiscal year starts in April would
 * look like a bug to anyone reading the screen. Fiscal-year boundaries still
 * govern the P&L period and retained earnings -- see `fiscalYearOf`.
 */
export function sequenceYearOf(date: Date): number {
  return date.getUTCFullYear();
}

/**
 * India's fiscal year runs April -> March, so 15-Sep-2026 and 10-Feb-2027 are
 * both FY2026. Configurable via CompanySettings.fiscalYearStartMonth.
 */
export function fiscalYearOf(date: Date, startMonth = 4): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return month >= startMonth ? year : year - 1;
}

/** [start, end] of a fiscal year, both inclusive, at UTC midnight. */
export function fiscalYearRange(fiscalYear: number, startMonth = 4): { start: Date; end: Date } {
  const start = new Date(Date.UTC(fiscalYear, startMonth - 1, 1));
  const end = new Date(Date.UTC(fiscalYear + 1, startMonth - 1, 1) - 86_400_000);
  return { start, end };
}

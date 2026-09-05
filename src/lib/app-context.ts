import { accountingDate, fiscalYearOf, fiscalYearRange, toIsoDate } from "./accounting/dates";

/**
 * "Today", for the whole application.
 *
 * Pinned by DEMO_TODAY so every report is reproducible: the Balance Sheet "as
 * of today" must show the same figures on the day the seed was written and on
 * the day it is demonstrated. Unset, it falls back to the real date.
 */
export function today(): Date {
  const pinned = process.env.DEMO_TODAY;
  return pinned ? accountingDate(pinned) : accountingDate(new Date().toISOString().slice(0, 10));
}

export function currentFiscalYear(startMonth = 4) {
  const now = today();
  const year = fiscalYearOf(now, startMonth);
  const { start, end } = fiscalYearRange(year, startMonth);
  return { year, start, end, label: `FY ${year}\u2013${String(year + 1).slice(2)}` };
}

/** "15 Sep 2026" — the format used on every screen and every printout. */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "15 Sep" — for dense tables where the year is implied by the filter. */
export function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export { toIsoDate };

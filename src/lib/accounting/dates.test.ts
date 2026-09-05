import { describe, it, expect } from "vitest";

import {
  accountingDate,
  toIsoDate,
  atUtcMidnight,
  sequenceYearOf,
  fiscalYearOf,
  fiscalYearRange,
} from "./dates";
import { formatDocumentNumber } from "./sequence";

describe("accountingDate", () => {
  it("pins the date to UTC midnight regardless of the machine's zone", () => {
    const date = accountingDate("2026-09-15");
    expect(date.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(toIsoDate(date)).toBe("2026-09-15");
  });

  it("strips a time component without shifting the calendar day", () => {
    // A Mumbai timestamp late on the 2nd is still the 2nd. Using local getters
    // here is how an invoice slips into the wrong month's P&L.
    const evening = new Date("2026-09-02T18:30:00.000Z");
    expect(toIsoDate(atUtcMidnight(evening))).toBe("2026-09-02");
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(() => accountingDate("15-09-2026")).toThrow();
    expect(() => accountingDate("2026-9-5")).toThrow();
  });
});

describe("fiscal year vs sequence year — deliberately different", () => {
  it("runs the fiscal year April to March", () => {
    expect(fiscalYearOf(accountingDate("2026-04-01"))).toBe(2026);
    expect(fiscalYearOf(accountingDate("2026-09-15"))).toBe(2026);
    expect(fiscalYearOf(accountingDate("2027-02-10"))).toBe(2026);
    expect(fiscalYearOf(accountingDate("2026-03-31"))).toBe(2025);
  });

  it("numbers documents by CALENDAR year, so the screen reads correctly", () => {
    // 10-Feb-2027 is fiscal 2026 but must print INV/2027/xxxx. An invoice dated
    // February 2027 showing "2026" in its own number looks like a bug to
    // everyone who is not an accountant.
    const feb = accountingDate("2027-02-10");
    expect(fiscalYearOf(feb)).toBe(2026);
    expect(sequenceYearOf(feb)).toBe(2027);
  });

  it("computes an inclusive fiscal year range", () => {
    const { start, end } = fiscalYearRange(2026);
    expect(toIsoDate(start)).toBe("2026-04-01");
    expect(toIsoDate(end)).toBe("2027-03-31");
  });

  it("honours a configured start month", () => {
    expect(fiscalYearOf(accountingDate("2026-03-31"), 1)).toBe(2026);
    expect(toIsoDate(fiscalYearRange(2026, 1).end)).toBe("2026-12-31");
  });
});

describe("formatDocumentNumber", () => {
  it("prints the year segment for invoices and bills", () => {
    expect(formatDocumentNumber("INV/", 2026, 1, 4, true)).toBe("INV/2026/0001");
    expect(formatDocumentNumber("BILL/", 2026, 12, 4, true)).toBe("BILL/2026/0012");
  });

  it("omits it for orders, which the mockup writes as PO0001", () => {
    expect(formatDocumentNumber("PO", 2026, 1, 4, false)).toBe("PO0001");
    expect(formatDocumentNumber("SO", 2026, 137, 4, false)).toBe("SO0137");
  });

  it("does not truncate once the counter outgrows its padding", () => {
    expect(formatDocumentNumber("PO", 2026, 12345, 4, false)).toBe("PO12345");
  });
});

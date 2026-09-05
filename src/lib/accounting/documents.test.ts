import { describe, it, expect } from "vitest";

import { paymentStateFor, documentTotals } from "./documents";
import { rupeesToPaise } from "@/lib/money";

describe("paymentStateFor — the mockup's badge legend, evaluated in order", () => {
  const total = rupeesToPaise(47200);

  it("Paid when nothing is due", () => {
    expect(paymentStateFor(total, 0n)).toBe("PAID");
  });

  it("Not Paid when the whole amount is still due", () => {
    expect(paymentStateFor(total, total)).toBe("NOT_PAID");
  });

  it("Partial for anything in between", () => {
    expect(paymentStateFor(total, rupeesToPaise(22000))).toBe("PARTIAL");
    expect(paymentStateFor(total, 1n)).toBe("PARTIAL");
    expect(paymentStateFor(total, total - 1n)).toBe("PARTIAL");
  });

  it("calls a zero-total document Paid, not Not Paid", () => {
    // The spec's two rules overlap here -- due = 0 satisfies both "Paid" and
    // "Partial", and total = residual = 0 satisfies both "Paid" and "Not Paid".
    // The badges are declared mutually exclusive, so order decides, and Paid
    // wins. The database CHECK compiles the identical branch, so a disagreement
    // between this function and the constraint is a failed INSERT, not a typo
    // that survives to the demo.
    expect(paymentStateFor(0n, 0n)).toBe("PAID");
  });
});

describe("documentTotals", () => {
  it("totals the demo invoice: 10 tables at Rs 5,000 plus 18%", () => {
    const totals = documentTotals([{ subtotalPaise: rupeesToPaise(50000), taxRateBp: 1800 }]);
    expect(totals.untaxedPaise).toBe(rupeesToPaise(50000));
    expect(totals.taxPaise).toBe(rupeesToPaise(9000));
    expect(totals.totalPaise).toBe(rupeesToPaise(59000));
  });

  it("treats an untaxed line as untaxed rather than defaulting to 18%", () => {
    const totals = documentTotals([
      { subtotalPaise: rupeesToPaise(1000), taxRateBp: 1800 },
      { subtotalPaise: rupeesToPaise(2400), taxRateBp: null },
    ]);
    expect(totals.untaxedPaise).toBe(rupeesToPaise(3400));
    expect(totals.taxPaise).toBe(rupeesToPaise(180));
    expect(totals.totalPaise).toBe(rupeesToPaise(3580));
  });

  it("sums per-line tax instead of taxing the document total", () => {
    const lines = [
      { subtotalPaise: 130n, taxRateBp: 500 },
      { subtotalPaise: 130n, taxRateBp: 500 },
    ];
    expect(documentTotals(lines).taxPaise).toBe(14n);
  });

  it("keeps total = untaxed + tax, which the CHECK constraint also asserts", () => {
    const totals = documentTotals([
      { subtotalPaise: 12345n, taxRateBp: 1800 },
      { subtotalPaise: 67891n, taxRateBp: 500 },
      { subtotalPaise: 22222n, taxRateBp: null },
    ]);
    expect(totals.totalPaise).toBe(totals.untaxedPaise + totals.taxPaise);
  });

  it("returns zeroes for an empty document", () => {
    expect(documentTotals([])).toEqual({ untaxedPaise: 0n, taxPaise: 0n, totalPaise: 0n });
  });
});

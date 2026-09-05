import { describe, it, expect } from "vitest";

import {
  rupeesToPaise,
  qtyToMilli,
  divRoundHalfUp,
  lineSubtotalPaise,
  taxOnLinePaise,
  netFromInclusivePaise,
  formatINR,
  sumPaise,
} from "./money";

describe("rupeesToPaise", () => {
  it("parses the string form rather than multiplying by 100", () => {
    // The whole reason this function exists: 19.99 * 100 is
    // 1998.9999999999998, and Math.round hiding that is how a ledger ends up
    // one paisa short six months later.
    expect(19.99 * 100).not.toBe(1999);
    expect(rupeesToPaise(19.99)).toBe(1999n);
    expect(rupeesToPaise("19.99")).toBe(1999n);
  });

  it("handles whole rupees, one decimal place and zero", () => {
    expect(rupeesToPaise(5000)).toBe(500000n);
    expect(rupeesToPaise("5000")).toBe(500000n);
    expect(rupeesToPaise("0.5")).toBe(50n);
    expect(rupeesToPaise(0)).toBe(0n);
  });

  it("survives float addition error in the input", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30n);
  });

  it("rejects anything that is not a rupee amount", () => {
    expect(() => rupeesToPaise("12.345")).toThrow();
    expect(() => rupeesToPaise("Rs 12")).toThrow();
    expect(() => rupeesToPaise("")).toThrow();
  });
});

describe("qtyToMilli", () => {
  it("carries three decimal places", () => {
    expect(qtyToMilli(1)).toBe(1000n);
    expect(qtyToMilli(2.5)).toBe(2500n);
    expect(qtyToMilli("0.125")).toBe(125n);
  });
});

describe("divRoundHalfUp", () => {
  it("rounds a half up, not to even", () => {
    expect(divRoundHalfUp(5n, 10n)).toBe(1n); // 0.5 -> 1
    expect(divRoundHalfUp(15n, 10n)).toBe(2n); // 1.5 -> 2, not 2 by luck
    expect(divRoundHalfUp(25n, 10n)).toBe(3n); // 2.5 -> 3, where banker's would give 2
    expect(divRoundHalfUp(4n, 10n)).toBe(0n);
  });

  it("refuses negative operands rather than guessing a direction", () => {
    expect(() => divRoundHalfUp(-5n, 10n)).toThrow();
    expect(() => divRoundHalfUp(5n, 0n)).toThrow();
  });
});

describe("lineSubtotalPaise", () => {
  it("matches the mockup's worked example: 3 Qty x 2000", () => {
    expect(lineSubtotalPaise(qtyToMilli(3), rupeesToPaise(2000))).toBe(rupeesToPaise(6000));
  });

  it("handles fractional quantities", () => {
    expect(lineSubtotalPaise(qtyToMilli(2.5), rupeesToPaise(999.99))).toBe(rupeesToPaise(2499.98));
  });
});

describe("taxOnLinePaise", () => {
  it("computes 18% GST on the demo's line", () => {
    expect(taxOnLinePaise(rupeesToPaise(5000), 1800)).toBe(rupeesToPaise(900));
    expect(taxOnLinePaise(rupeesToPaise(40000), 1800)).toBe(rupeesToPaise(7200));
  });

  it("rounds per line, which is NOT the same as taxing the total", () => {
    // Two lines of Rs 1.30 at 5%.
    //   per line : round(6.5) = 7 paise, twice   -> 14 paise
    //   on total : round(13.0)                   -> 13 paise
    // Rounding the document total would print a tax the line taxes do not add
    // up to, and then the journal entry would refuse to balance.
    const line = 130n;
    const perLine = taxOnLinePaise(line, 500) + taxOnLinePaise(line, 500);
    const onTotal = taxOnLinePaise(line * 2n, 500);

    expect(perLine).toBe(14n);
    expect(onTotal).toBe(13n);
    expect(perLine).not.toBe(onTotal);
  });
});

describe("netFromInclusivePaise", () => {
  it("backs Rs 5,900 inclusive of 18% out to Rs 5,000", () => {
    expect(netFromInclusivePaise(rupeesToPaise(5900), 1800)).toBe(rupeesToPaise(5000));
  });
});

describe("formatINR", () => {
  it("groups in the Indian style, not in thousands", () => {
    expect(formatINR(rupeesToPaise(992000))).toBe("Rs. 9,92,000.00");
    expect(formatINR(rupeesToPaise(200000))).toBe("Rs. 2,00,000.00");
    expect(formatINR(rupeesToPaise(100))).toBe("Rs. 100.00");
    expect(formatINR(rupeesToPaise(1000))).toBe("Rs. 1,000.00");
  });

  it("keeps paise and handles negatives and zero", () => {
    expect(formatINR(rupeesToPaise("47200.50"))).toBe("Rs. 47,200.50");
    expect(formatINR(-rupeesToPaise(1500))).toBe("-Rs. 1,500.00");
    expect(formatINR(0n)).toBe("Rs. 0.00");
    expect(formatINR(rupeesToPaise(5), { symbol: false })).toBe("5.00");
  });
});

describe("sumPaise", () => {
  it("sums exactly, where floats would not", () => {
    const tenths = Array.from({ length: 10 }, () => rupeesToPaise(0.1));
    expect(sumPaise(tenths)).toBe(rupeesToPaise(1));
  });
});

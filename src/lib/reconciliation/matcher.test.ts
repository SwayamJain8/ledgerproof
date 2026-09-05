import { describe, expect, it } from "vitest";

import {
  AUTO_MATCH_MIN_CONFIDENCE,
  matchLine,
  matchStatement,
  normalise,
  referenceMatch,
  scoreCandidate,
  trigramSimilarity,
  type OpenDocument,
  type StatementLine,
} from "./matcher";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

const invoice = (over: Partial<OpenDocument> = {}): OpenDocument => ({
  id: "i1",
  kind: "INVOICE",
  name: "INV/2026/0007",
  partnerName: "Nimesh Pathak",
  residualPaise: 4_720_000n,
  date: d("2026-09-01"),
  ...over,
});

const line = (over: Partial<StatementLine> = {}): StatementLine => ({
  id: "l1",
  date: d("2026-09-15"),
  narration: "NEFT/N PATHAK/INV-2026-0007",
  amountPaise: 4_720_000n,
  ...over,
});

describe("normalise", () => {
  it("strips the separators Indian bank narrations use", () => {
    expect(normalise("NEFT/N PATHAK/INV-2026-0007")).toBe("NEFT N PATHAK INV 2026 0007");
    expect(normalise("UPI CR  16992   AZURE FURN.")).toBe("UPI CR 16992 AZURE FURN");
  });
});

describe("trigramSimilarity", () => {
  it("is 1 for identical strings and 0 for unrelated ones", () => {
    expect(trigramSimilarity("Azure Furniture", "Azure Furniture")).toBe(1);
    expect(trigramSimilarity("Azure Furniture", "Zzzz")).toBeLessThan(0.1);
  });

  it("still scores a partial abbreviation above an unrelated name", () => {
    const abbreviated = trigramSimilarity("UPI CR AZURE FURN", "Azure Furniture");
    const unrelated = trigramSimilarity("UPI CR AZURE FURN", "Open Wood");
    expect(abbreviated).toBeGreaterThan(unrelated);
  });
});

describe("referenceMatch", () => {
  it("matches across slash, dash and space separators", () => {
    expect(referenceMatch("NEFT/N PATHAK/INV-2026-0007", "INV/2026/0007")).toBe("FULL");
    expect(referenceMatch("PAYMENT INV 2026 0007", "INV/2026/0007")).toBe("FULL");
  });

  it("falls back to the bare counter", () => {
    expect(referenceMatch("NEFT REF 0007 PATHAK", "INV/2026/0007")).toBe("COUNTER");
  });

  it("does not match a counter buried inside a longer number", () => {
    // "16992" must not satisfy a document numbered 0007 or 6992.
    expect(referenceMatch("UPI CR 16992 AZURE FURN", "INV/2026/6992")).toBeNull();
  });

  it("returns null when nothing cites the document", () => {
    expect(referenceMatch("ATM WDL SELF", "INV/2026/0007")).toBeNull();
  });
});

describe("scoreCandidate", () => {
  it("clears the auto-match bar on reference + exact amount alone", () => {
    const scored = scoreCandidate(line(), invoice());
    expect(scored.confidence).toBeGreaterThanOrEqual(AUTO_MATCH_MIN_CONFIDENCE);
  });

  it("scores a wrong amount far below a right one", () => {
    const right = scoreCandidate(line(), invoice());
    const wrong = scoreCandidate(line({ amountPaise: 999_900n }), invoice());
    expect(wrong.confidence).toBeLessThan(right.confidence);
  });

  it("explains itself — every point is attributable to a named signal", () => {
    const scored = scoreCandidate(line(), invoice());
    const total = scored.signals.reduce((s, x) => s + x.points, 0);
    expect(scored.confidence).toBe(Math.min(100, total));
    expect(scored.signals.length).toBeGreaterThan(0);
  });

  it("treats a smaller amount as a possible part payment rather than a mismatch", () => {
    const scored = scoreCandidate(line({ amountPaise: 1_000_000n }), invoice());
    expect(scored.signals.some((s) => s.label.includes("part payment"))).toBe(true);
  });
});

describe("matchLine", () => {
  it("never offers a vendor bill for money coming in", () => {
    const bill: OpenDocument = {
      id: "b1",
      kind: "BILL",
      name: "BILL/2026/0007",
      partnerName: "Nimesh Pathak",
      residualPaise: 4_720_000n,
      date: d("2026-09-01"),
    };
    const result = matchLine(line(), [bill]);
    expect(result.candidates).toHaveLength(0);
    expect(result.autoMatch).toBeNull();
  });

  it("offers bills, not invoices, for money going out", () => {
    const bill: OpenDocument = {
      id: "b1",
      kind: "BILL",
      name: "BILL/2026/0003",
      partnerName: "Azure Furniture",
      residualPaise: 1_699_200n,
      date: d("2026-09-02"),
    };
    const outgoing = line({
      narration: "NEFT DR AZURE FURNITURE BILL-2026-0003",
      amountPaise: -1_699_200n,
    });
    const result = matchLine(outgoing, [bill, invoice()]);
    expect(result.autoMatch?.document.id).toBe("b1");
  });

  it("refuses to auto-match when two documents are equally plausible", () => {
    // Same partner, same amount, no reference in the narration.
    const a = invoice({ id: "a", name: "INV/2026/0011" });
    const b = invoice({ id: "b", name: "INV/2026/0012" });
    const ambiguous = line({ narration: "NEFT N PATHAK" });
    const result = matchLine(ambiguous, [a, b]);
    expect(result.autoMatch).toBeNull();
    expect(result.candidates.length).toBeGreaterThan(1);
  });

  it("ignores documents that are already settled", () => {
    const settled = invoice({ residualPaise: 0n });
    expect(matchLine(line(), [settled]).candidates).toHaveLength(0);
  });
});

describe("matchStatement", () => {
  it("does not let two lines auto-clear the same invoice", () => {
    const only = invoice();
    const twice = [line({ id: "l1" }), line({ id: "l2" })];
    const results = matchStatement(twice, [only]);
    const auto = results.filter((r) => r.autoMatch);
    expect(auto).toHaveLength(1);
  });

  it("matches the confident lines and leaves the rest for a human", () => {
    const docs = [
      invoice({ id: "i1", name: "INV/2026/0007", residualPaise: 4_720_000n }),
      invoice({ id: "i2", name: "INV/2026/0008", partnerName: "Rahul Sharma", residualPaise: 5_900_000n }),
    ];
    const lines = [
      line({ id: "l1", narration: "NEFT/N PATHAK/INV-2026-0007", amountPaise: 4_720_000n }),
      line({ id: "l2", narration: "SOME UNRELATED CREDIT", amountPaise: 123_400n }),
    ];
    const results = matchStatement(lines, docs);
    expect(results[0].autoMatch?.document.id).toBe("i1");
    expect(results[1].autoMatch).toBeNull();
  });
});

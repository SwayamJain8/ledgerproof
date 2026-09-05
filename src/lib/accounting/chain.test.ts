import { describe, expect, it } from "vitest";

import { canonicalise, hashEntry, type ChainableEntry } from "./chain";

const entry = (over: Partial<ChainableEntry> = {}): ChainableEntry => ({
  name: "INV/2026/0001",
  journalId: "jrnl_sales",
  date: new Date("2026-05-12T00:00:00Z"),
  ref: "SO-26-001",
  partnerId: "c_nimesh",
  sourceType: "CUSTOMER_INVOICE",
  sourceId: "inv_1",
  totalDebitPaise: 5_900_000n,
  totalCreditPaise: 5_900_000n,
  items: [
    { lineNo: 1, accountId: "a_debtors", debitPaise: 5_900_000n, creditPaise: 0n },
    { lineNo: 2, accountId: "a_sales", debitPaise: 0n, creditPaise: 5_000_000n },
    { lineNo: 3, accountId: "a_gst_out", debitPaise: 0n, creditPaise: 900_000n },
  ],
  ...over,
});

describe("canonicalise", () => {
  it("is stable for the same entry", () => {
    expect(canonicalise(entry())).toBe(canonicalise(entry()));
  });

  it("does not depend on the order items arrive in", () => {
    const forwards = entry();
    const backwards = entry({ items: [...entry().items].reverse() });
    expect(canonicalise(backwards)).toBe(canonicalise(forwards));
  });

  it("covers every field a forger would want to change", () => {
    const base = canonicalise(entry());
    expect(canonicalise(entry({ name: "INV/2026/0002" }))).not.toBe(base);
    expect(canonicalise(entry({ date: new Date("2026-05-13T00:00:00Z") }))).not.toBe(base);
    expect(canonicalise(entry({ partnerId: "c_joey" }))).not.toBe(base);
    expect(canonicalise(entry({ totalDebitPaise: 1n }))).not.toBe(base);
    expect(canonicalise(entry({ sourceId: "inv_2" }))).not.toBe(base);
  });

  it("changes when a single line amount changes", () => {
    const tampered = entry();
    tampered.items[0] = { ...tampered.items[0], debitPaise: 9_999_900n };
    expect(canonicalise(tampered)).not.toBe(canonicalise(entry()));
  });

  it("changes when a line is posted to a different account", () => {
    const tampered = entry();
    tampered.items[1] = { ...tampered.items[1], accountId: "a_other_income" };
    expect(canonicalise(tampered)).not.toBe(canonicalise(entry()));
  });
});

describe("hashEntry", () => {
  it("produces a 64-character sha256 digest", () => {
    expect(hashEntry(null, entry())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("depends on the previous hash, so position in the chain matters", () => {
    const first = hashEntry(null, entry());
    const later = hashEntry("a".repeat(64), entry());
    expect(first).not.toBe(later);
  });

  it("is deterministic", () => {
    expect(hashEntry("abc", entry())).toBe(hashEntry("abc", entry()));
  });

  it("changes if any sealed field changes", () => {
    const base = hashEntry("abc", entry());
    const tampered = entry();
    tampered.items[0] = { ...tampered.items[0], debitPaise: 1n };
    expect(hashEntry("abc", tampered)).not.toBe(base);
  });

  it("makes every later hash wrong once an earlier entry is altered", () => {
    // This is the property a per-row checksum does not have, and the reason a
    // chain is worth building: you cannot edit the middle of the book.
    const honestFirst = hashEntry(null, entry({ name: "A" }));
    const honestSecond = hashEntry(honestFirst, entry({ name: "B" }));

    const forgedFirst = hashEntry(null, entry({ name: "A", totalDebitPaise: 1n }));
    const forgedSecond = hashEntry(forgedFirst, entry({ name: "B" }));

    expect(forgedFirst).not.toBe(honestFirst);
    expect(forgedSecond).not.toBe(honestSecond);
  });
});

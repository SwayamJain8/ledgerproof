import { describe, it, expect } from "vitest";

import { closeEntry, assertBalanced, type PostingLine } from "./posting";
import { PostingError, UnbalancedEntryError } from "./errors";
import { rupeesToPaise } from "@/lib/money";

const DEBTORS = { accountId: "acc_debtors", partnerId: "contact_1" };

function line(accountId: string, debit: bigint, credit: bigint): PostingLine {
  return { accountId, label: accountId, debitPaise: debit, creditPaise: credit };
}

describe("closeEntry — the balancing line is derived, never computed", () => {
  it("derives the receivable on a customer invoice", () => {
    // Rs 5,000 net + Rs 900 GST. Nothing anywhere adds 5000 + 900; the engine
    // only knows that debits must equal credits.
    const lines = [
      line("acc_sales", 0n, rupeesToPaise(5000)),
      line("acc_output_gst", 0n, rupeesToPaise(900)),
    ];
    closeEntry(lines, DEBTORS);

    expect(lines).toHaveLength(3);
    expect(lines[2]).toMatchObject({
      accountId: "acc_debtors",
      partnerId: "contact_1",
      debitPaise: rupeesToPaise(5900),
      creditPaise: 0n,
    });
  });

  it("derives the payable on a vendor bill", () => {
    const lines = [
      line("acc_purchase", rupeesToPaise(3000), 0n),
      line("acc_input_gst", rupeesToPaise(540), 0n),
    ];
    closeEntry(lines, { accountId: "acc_creditors" });

    expect(lines[2]).toMatchObject({
      accountId: "acc_creditors",
      debitPaise: 0n,
      creditPaise: rupeesToPaise(3540),
    });
  });

  it("absorbs per-line rounding quirks into the control line", () => {
    // This is the property that makes the design worth it. Three lines whose
    // taxes each round up leave the entry lopsided by a paisa or two -- and the
    // control account swallows it, which is where an accountant expects it.
    const lines = [
      line("acc_sales", 0n, 333n),
      line("acc_sales", 0n, 333n),
      line("acc_sales", 0n, 333n),
      line("acc_output_gst", 0n, 60n),
    ];
    closeEntry(lines, DEBTORS);

    const debit = lines.reduce((s, l) => s + l.debitPaise, 0n);
    const credit = lines.reduce((s, l) => s + l.creditPaise, 0n);
    expect(debit).toBe(credit);
    expect(lines.at(-1)!.debitPaise).toBe(1059n);
  });

  it("adds nothing when the entry already balances", () => {
    const lines = [
      line("acc_rent", rupeesToPaise(15000), 0n),
      line("acc_bank", 0n, rupeesToPaise(15000)),
    ];
    closeEntry(lines, null);
    expect(lines).toHaveLength(2);
  });

  it("refuses to invent a control account when one is needed", () => {
    const lines = [line("acc_sales", 0n, rupeesToPaise(5000))];
    expect(() => closeEntry(lines, null)).toThrow(PostingError);
    expect(() => closeEntry(lines, null)).toThrow(/NO_CONTROL_ACCOUNT/);
  });
});

describe("assertBalanced", () => {
  it("returns the totals when debits equal credits", () => {
    const lines = [
      line("a", rupeesToPaise(100), 0n),
      line("b", 0n, rupeesToPaise(100)),
    ];
    expect(assertBalanced(lines)).toEqual({
      debitPaise: rupeesToPaise(100),
      creditPaise: rupeesToPaise(100),
    });
  });

  it("throws with both totals when they differ", () => {
    const lines = [
      line("a", rupeesToPaise(100), 0n),
      line("b", 0n, rupeesToPaise(99)),
    ];
    expect(() => assertBalanced(lines)).toThrow(UnbalancedEntryError);
  });

  it("rejects a one-legged entry even though it trivially balances at zero", () => {
    expect(() => assertBalanced([line("a", 0n, 0n)])).toThrow(/EMPTY_DOCUMENT/);
    expect(() => assertBalanced([])).toThrow();
  });
});

/**
 * Money is integer paise, end to end. Never a float, never a Decimal object.
 *
 * The reason is narrow and specific: the posting engine asserts
 * `sum(debit) === sum(credit)`. With floats that comparison fails at 3 a.m. for
 * no visible reason; with Decimal objects it needs `.equals()` and one `===`
 * slipping through is a silent wrong answer. With bigint, `===` is exact.
 *
 *   Rs 47,200.00  ->  4_720_000n paise
 */

export type Paise = bigint;

/** Rs 1 = 100 paise. */
export const PAISE_PER_RUPEE = 100n;

/** Tax rates are basis points: 18.00% -> 1800. */
export const BP_DENOMINATOR = 10_000n;

/** Quantities are milli-units: 2.5 units -> 2500. */
export const MILLI = 1_000n;

/**
 * Rs -> paise. Accepts "1234.56", 1234.56 or 1234.
 *
 * Parses the string form rather than multiplying the number by 100, because
 * `19.99 * 100` is `1998.9999999999998`.
 */
export function rupeesToPaise(rupees: number | string): Paise {
  const text = typeof rupees === "number" ? rupees.toFixed(2) : rupees.trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    throw new Error(`rupeesToPaise: "${rupees}" is not a rupee amount`);
  }
  const [, sign, whole, frac = "0"] = match;
  const paise = BigInt(whole) * PAISE_PER_RUPEE + BigInt(frac.padEnd(2, "0"));
  return sign ? -paise : paise;
}

/** Quantity -> milli-units. 2.5 -> 2500n. */
export function qtyToMilli(qty: number | string): bigint {
  const text = typeof qty === "number" ? qty.toFixed(3) : qty.trim();
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(text);
  if (!match) {
    throw new Error(`qtyToMilli: "${qty}" is not a quantity`);
  }
  const [, whole, frac = "0"] = match;
  return BigInt(whole) * MILLI + BigInt(frac.padEnd(3, "0"));
}

/**
 * Divide and round half up. Both operands must be non-negative.
 *
 * Used for tax (`subtotal * rateBp / 10000`) and for line subtotals
 * (`qtyMilli * pricePaise / 1000`). The line-subtotal form is mirrored exactly
 * by the CHECK constraint `*_line_subtotal_correct`, so TypeScript and Postgres
 * cannot disagree about what a line total is.
 */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new Error(`divRoundHalfUp: expects non-negative operands, got ${numerator}/${denominator}`);
  }
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/** Line total, in paise. Mockup: "Unit Price * Quantity" / "(3Qty * 2000)". */
export function lineSubtotalPaise(quantityMilli: bigint, unitPricePaise: bigint): Paise {
  return divRoundHalfUp(quantityMilli * unitPricePaise, MILLI);
}

/**
 * Tax on one line, in paise.
 *
 * Rounded PER LINE and then summed -- never computed on the document total.
 * Rounding the total instead produces a figure that differs from the sum of the
 * displayed line taxes by a paisa, and then the entry will not post.
 */
export function taxOnLinePaise(subtotalPaise: Paise, rateBp: number): Paise {
  return divRoundHalfUp(subtotalPaise * BigInt(rateBp), BP_DENOMINATOR);
}

/**
 * Back out the net from a tax-inclusive gross.
 * Rs 5,900 at 18% inclusive -> net Rs 5,000.
 */
export function netFromInclusivePaise(grossPaise: Paise, rateBp: number): Paise {
  return divRoundHalfUp(grossPaise * BP_DENOMINATOR, BP_DENOMINATOR + BigInt(rateBp));
}

/**
 * Indian digit grouping: 2,00,000 not 200,000.
 *
 * The mockup writes money as "Rs. 100.00" and its budget samples use Indian
 * grouping ("2,00,000"), so this is the only money formatter in the app.
 */
export function formatINR(paise: Paise, opts: { symbol?: boolean } = {}): string {
  const { symbol = true } = opts;
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;

  const rupees = abs / PAISE_PER_RUPEE;
  const fraction = abs % PAISE_PER_RUPEE;

  const digits = rupees.toString();
  // Last three digits stay together; everything above is grouped in pairs.
  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const head = digits.slice(0, -3);
    const tail = digits.slice(-3);
    grouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + tail;
  }

  const body = `${grouped}.${fraction.toString().padStart(2, "0")}`;
  return `${negative ? "-" : ""}${symbol ? "Rs. " : ""}${body}`;
}

/** For debugging and test assertions: 4720000n -> "47200.00". */
export function paiseToRupeeString(paise: Paise): string {
  return formatINR(paise, { symbol: false });
}

/** Sum helper that keeps the bigint-ness obvious at call sites. */
export function sumPaise(values: Iterable<Paise>): Paise {
  let total = 0n;
  for (const value of values) total += value;
  return total;
}

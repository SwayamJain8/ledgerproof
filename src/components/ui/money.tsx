import { formatINR } from "@/lib/money";
import { cn } from "./cn";

/**
 * The only way money is rendered in this application.
 *
 * Three conventions, all borrowed from printed ledgers rather than invented:
 *   - right-aligned, tabular figures, so columns of numbers line up on the
 *     decimal and the eye can scan down them
 *   - negatives in oxide red, never with a minus sign hiding at the far left
 *   - zero rendered as a muted em dash, because a page of "Rs. 0.00" is noise
 */
export function Money({
  paise,
  className,
  symbol = false,
  dashZero = true,
  emphasis = false,
}: {
  paise: bigint;
  className?: string;
  symbol?: boolean;
  /** Render 0 as an em dash. Turn off for totals, where an explicit 0 matters. */
  dashZero?: boolean;
  emphasis?: boolean;
}) {
  if (paise === 0n && dashZero) {
    return <span className={cn("tnum text-ink-4 tabular-nums", className)}>&mdash;</span>;
  }

  return (
    <span
      className={cn(
        "tnum tabular-nums whitespace-nowrap",
        paise < 0n && "text-oxide",
        emphasis && "font-semibold",
        className,
      )}
    >
      {formatINR(paise, { symbol })}
    </span>
  );
}

/** Quantities are milli-units; trailing zeroes are dropped so "3" reads as "3". */
export function Qty({ milli, className }: { milli: bigint; className?: string }) {
  const whole = milli / 1000n;
  const frac = milli % 1000n;
  const text =
    frac === 0n
      ? whole.toString()
      : `${whole}.${frac.toString().padStart(3, "0").replace(/0+$/, "")}`;
  return <span className={cn("tnum tabular-nums", className)}>{text}</span>;
}

export function Percent({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("tnum tabular-nums", className)}>
      {value.toFixed(value % 1 === 0 ? 0 : 1)}%
    </span>
  );
}

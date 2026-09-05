import Link from "next/link";

import { cn } from "@/components/ui/cn";

/**
 * The claim this whole application rests on, shown at all times.
 *
 * Every posted debit and every posted credit, summed, must be equal. It is one
 * query, it is cheap, and putting it in the chrome means nobody has to take our
 * word for it — if the ledger ever stopped balancing, the header would say so
 * on every screen. Clicking through goes to the full integrity report.
 */
export function LedgerPulse({
  balanced,
  itemCount,
  entryCount,
}: {
  balanced: boolean;
  itemCount: number;
  entryCount: number;
}) {
  return (
    <Link
      href="/reports/integrity"
      title={`${itemCount} journal items across ${entryCount} entries`}
      className={cn(
        "group inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11.5px] transition-colors",
        balanced
          ? "border-ledger/20 bg-ledger-2/60 text-ledger hover:bg-ledger-2"
          : "border-oxide/30 bg-oxide-2 text-oxide",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          balanced ? "bg-ledger" : "animate-pulse bg-oxide",
        )}
      />
      <span className="font-medium">{balanced ? "Books balanced" : "Out of balance"}</span>
      <span className="tnum hidden text-ink-3 md:inline">{itemCount} items</span>
    </Link>
  );
}

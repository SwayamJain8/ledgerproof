import { cn } from "./ui/cn";

/**
 * The mark: a chair rendered as four strokes, next to the name.
 *
 * Drawn rather than imported so it inherits currentColor and sits correctly on
 * both the oak sidebar and the paper sign-in card.
 */
export function ChairMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("h-5 w-5", className)} aria-hidden>
      {/* back */}
      <path d="M7 3.5h10l-1 8H8l-1-8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      {/* seat */}
      <path d="M5.5 11.5h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* legs */}
      <path d="M7.5 11.5 6 20.5M16.5 11.5 18 20.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({
  className,
  subdued,
}: {
  className?: string;
  subdued?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <ChairMark className={subdued ? "text-brass" : "text-walnut"} />
      <span className="leading-none">
        <span className="block font-display text-[15px] font-medium tracking-[-0.005em]">
          Urban Furniture
        </span>
        <span
          className={cn(
            "mt-0.5 block text-[9.5px] font-semibold tracking-[0.18em] uppercase",
            subdued ? "text-brass/70" : "text-ink-3",
          )}
        >
          Accounts
        </span>
      </span>
    </span>
  );
}

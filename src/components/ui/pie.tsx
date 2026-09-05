import { cn } from "./cn";

/**
 * A donut showing achieved against balance, sized to sit inside a table row.
 *
 * The mockup draws a pie chart in a column of the Budget Report list, which is
 * unusual enough to be worth doing literally. Inline SVG rather than a charting
 * library: one row needs about 400 bytes of markup, it renders on the server
 * with no hydration, and it prints.
 *
 * Colour comes from `currentColor`, so the caller sets the tone with a text
 * class and the same component covers under-budget and over-budget.
 */
export function BudgetPie({
  percent,
  size = 30,
  className,
  title,
}: {
  /** Achieved as a percentage of committed. May exceed 100. */
  percent: number;
  size?: number;
  className?: string;
  title?: string;
}) {
  const clamped = Math.max(0, Math.min(percent, 100));
  const stroke = size / 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (clamped / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={title ?? `${Math.round(percent)} percent achieved`}
    >
      {title ? <title>{title}</title> : null}

      {/* The balance still to spend. */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-rule-2"
        opacity={0.5}
      />

      {/* The achieved portion, drawn clockwise from twelve o'clock. */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        stroke="currentColor"
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="butt"
        transform={`scale(1,-1) translate(0,-${size})`}
      />
    </svg>
  );
}

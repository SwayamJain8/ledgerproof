"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "./cn";

/**
 * The click behaviour behind `LinkRow`.
 *
 * A whole table row cannot legally contain an anchor that wraps its cells, and
 * stretching an absolutely-positioned anchor over the row needs a positioned
 * ancestor that `<tr>` does not reliably provide. So the row listens for the
 * click itself.
 *
 * Three things this still gets right that a naive onClick would not:
 *   - a click on a button, link, input or select inside the row is left alone
 *   - text selection does not trigger navigation
 *   - Enter and Space work, and the row is reachable by keyboard
 */
export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const navigate = () => router.push(href);

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label="Open"
      onClick={(event) => {
        // Let anything genuinely interactive handle its own click.
        if ((event.target as HTMLElement).closest("a,button,input,select,textarea,label")) return;
        // Someone highlighting a figure is reading, not navigating.
        if (window.getSelection()?.toString()) return;
        navigate();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate();
        }
      }}
      className={cn(
        "group cursor-pointer transition-colors hover:bg-surface-2",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-walnut",
        className,
      )}
    >
      {children}
    </tr>
  );
}

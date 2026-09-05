import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";
import { ClickableRow } from "./clickable-row";

/* ─────────────────────────────────────────────────────────────────────────
   Panel — the ruled box everything sits in. Hairline borders, no shadows.
   ───────────────────────────────────────────────────────────────────────── */

export function Panel({
  className,
  children,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-md border border-rule bg-surface", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-4 border-b border-rule px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="truncate font-display text-[15px] leading-tight font-medium text-ink">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-ink-3">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Buttons
   ───────────────────────────────────────────────────────────────────────── */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium " +
  "transition-colors disabled:pointer-events-none disabled:opacity-45 " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brass";

const BUTTON_VARIANTS = {
  /* The one button on a screen that commits something: Confirm, Post, Register. */
  primary: "bg-walnut text-surface hover:bg-walnut-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
  secondary: "border border-rule-2 bg-surface text-ink hover:bg-surface-2 hover:border-rule-3",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  danger: "border border-oxide/25 bg-oxide-2 text-oxide hover:bg-oxide hover:text-surface",
} as const;

const BUTTON_SIZES = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8.5 px-3.5",
  lg: "h-10 px-5 text-sm",
} as const;

interface ButtonStyleProps {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & ButtonStyleProps) {
  return (
    <button
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyleProps) {
  return (
    <Link
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Badges — payment state, document state, account type
   ───────────────────────────────────────────────────────────────────────── */

const TONES = {
  neutral: "border-rule-2 bg-surface-3 text-ink-2",
  paid: "border-ledger/25 bg-ledger-2 text-ledger",
  partial: "border-amber/25 bg-amber-2 text-amber",
  unpaid: "border-oxide/20 bg-oxide-2 text-oxide",
  draft: "border-rule-2 bg-surface-2 text-ink-3",
  posted: "border-walnut/20 bg-walnut-3 text-walnut",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10.5px] font-semibold tracking-[0.055em] uppercase whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const PAYMENT_TONES: Record<string, BadgeTone> = {
  PAID: "paid",
  PARTIAL: "partial",
  NOT_PAID: "unpaid",
};

export function PaymentBadge({ state }: { state: string }) {
  return (
    <Badge tone={PAYMENT_TONES[state] ?? "neutral"}>{state.replace("_", " ")}</Badge>
  );
}

const DOC_TONES: Record<string, BadgeTone> = {
  DRAFT: "draft",
  POSTED: "posted",
  CONFIRMED: "posted",
  CANCELLED: "unpaid",
  BILLED: "paid",
  PARTIALLY_BILLED: "partial",
  REVISED: "partial",
};

export function StateBadge({ state }: { state: string }) {
  return <Badge tone={DOC_TONES[state] ?? "neutral"}>{state.replace(/_/g, " ")}</Badge>;
}

/* ─────────────────────────────────────────────────────────────────────────
   Tables — dense, ruled, and scannable. This is where users live.
   ───────────────────────────────────────────────────────────────────────── */

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-[13px]", className)} {...props} />
    </div>
  );
}

export function Th({
  className,
  numeric,
  ...props
}: ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "border-b border-rule-2 bg-surface-2 px-3 py-2 text-[10.5px] font-semibold tracking-[0.08em] whitespace-nowrap text-ink-3 uppercase",
        numeric ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  ...props
}: ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "border-b border-rule px-3 py-2 align-middle text-ink-2",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A table row that navigates.
 *
 * Implemented with a click handler rather than a stretched anchor. The obvious
 * version — `<Link className="absolute inset-0">` inside a cell — has no
 * positioned ancestor to stretch against, so it sizes itself against the page
 * and covers the entire screen with one invisible link. Giving the `<tr>`
 * `position: relative` fixes that in most browsers but is quirky enough on
 * table rows that it is not worth the risk on a screen someone is demoing.
 *
 * Clicks that land on something interactive inside the row are left alone, so
 * a button in a cell still does its own job.
 */
export function LinkRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ClickableRow href={href} className={className}>
      {children}
    </ClickableRow>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Page furniture
   ───────────────────────────────────────────────────────────────────────── */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="label-caps mb-1.5">{eyebrow}</p> : null}
        <h1 className="font-display text-[26px] leading-none font-normal tracking-[-0.01em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-3">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {/* A ruled square, echoing an empty ledger page. */}
      <div className="mb-4 h-10 w-10 rounded-sm border border-dashed border-rule-3 bg-surface-2" />
      <p className="font-display text-[15px] text-ink">{title}</p>
      {hint ? <p className="mt-1.5 max-w-sm text-[13px] text-ink-3">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Key/value pair, used across every document header. */
export function Detail({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 text-[13px] text-ink">{children}</dd>
    </div>
  );
}

/**
 * The stage bar from the mockup — Draft / Confirmed / Cancelled, with the
 * current stage filled. Odoo users read this before anything else on a form.
 */
export function StageBar({
  stages,
  current,
}: {
  stages: readonly string[];
  current: string;
}) {
  const index = stages.indexOf(current);
  return (
    <ol className="flex items-center gap-1">
      {stages.map((stage, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <li
            key={stage}
            className={cn(
              "px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em] uppercase",
              "border-y border-r border-rule-2 first:rounded-l-md first:border-l last:rounded-r-md",
              active && "border-walnut bg-walnut text-surface",
              done && "bg-walnut-3 text-walnut",
              !active && !done && "bg-surface text-ink-4",
            )}
          >
            {stage.replace(/_/g, " ")}
          </li>
        );
      })}
    </ol>
  );
}

import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";

const CONTROL =
  "w-full rounded-md border border-rule-2 bg-surface px-2.5 text-[13px] text-ink " +
  "placeholder:text-ink-4 transition-colors " +
  "hover:border-rule-3 focus:border-walnut focus:outline-none " +
  "focus:ring-2 focus:ring-walnut/15 disabled:bg-surface-3 disabled:text-ink-3";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-8.5", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        CONTROL,
        "h-8.5 appearance-none bg-[length:14px] bg-[right_0.5rem_center] bg-no-repeat pr-8",
        // Chevron drawn inline so there is no icon dependency inside a <select>.
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22%238a7d6d%22 stroke-width=%221.5%22><path d=%22M4 6l4 4 4-4%22/></svg>')]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="label-caps block">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-oxide">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

/** The inline error strip used above forms that failed server-side. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-oxide/25 bg-oxide-2 px-3 py-2 text-[13px] text-oxide"
    >
      {children}
    </p>
  );
}

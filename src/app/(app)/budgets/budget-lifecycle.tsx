"use client";

import { useFormStatus } from "react-dom";
import { Archive, CheckCircle2, GitBranch } from "lucide-react";

import { Button } from "@/components/ui/primitives";
import { cancelBudgetAction, confirmBudgetAction, reviseBudgetAction } from "./actions";

function Submit({
  label,
  busy,
  icon,
  variant,
}: {
  label: string;
  busy: string;
  icon: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant ?? "secondary"} disabled={pending}>
      {icon}
      {pending ? busy : label}
    </Button>
  );
}

/**
 * The budget's own state machine, rendered as the only actions legal right now.
 *
 * Revise is deliberately absent on a Draft and on an already-superseded budget:
 * the mockup shows it only at Confirmed, and offering a button that will be
 * rejected is worse than not offering it.
 */
export function BudgetLifecycle({
  budgetId,
  state,
  alreadyRevised,
}: {
  budgetId: string;
  state: string;
  alreadyRevised: boolean;
}) {
  if (state === "REVISED") {
    return <span className="text-[11.5px] text-ink-3">Superseded</span>;
  }
  if (state === "CANCELLED") {
    return <span className="text-[11.5px] text-ink-3">Archived</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {state === "DRAFT" ? (
        <form action={confirmBudgetAction}>
          <input type="hidden" name="budgetId" value={budgetId} />
          <Submit
            label="Confirm"
            busy="…"
            variant="primary"
            icon={<CheckCircle2 className="h-3 w-3" />}
          />
        </form>
      ) : null}

      {state === "CONFIRMED" && !alreadyRevised ? (
        <form action={reviseBudgetAction}>
          <input type="hidden" name="budgetId" value={budgetId} />
          <Submit label="Revise" busy="…" icon={<GitBranch className="h-3 w-3" />} />
        </form>
      ) : null}

      <form action={cancelBudgetAction}>
        <input type="hidden" name="budgetId" value={budgetId} />
        <Submit label="Cancel" busy="…" icon={<Archive className="h-3 w-3" />} />
      </form>
    </div>
  );
}

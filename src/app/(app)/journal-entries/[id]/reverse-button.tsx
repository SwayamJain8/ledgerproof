"use client";

import { useFormStatus } from "react-dom";
import { RotateCcw, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/primitives";
import { resetEntryAction, reverseEntryAction } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      <Undo2 className="h-3.5 w-3.5" />
      {pending ? "Cancelling\u2026" : "Cancel by reversal"}
    </Button>
  );
}

/**
 * The only way to undo a posted entry. There is no Edit button anywhere in this
 * application, and that is the point -- cancelling writes a mirror image rather
 * than erasing the original.
 */
export function ReverseButton({ entryId }: { entryId: string }) {
  return (
    <form action={reverseEntryAction}>
      <input type="hidden" name="entryId" value={entryId} />
      <Submit />
    </form>
  );
}

/**
 * Admin-only. Rendered only for an administrator AND only on the newest entry,
 * so an accountant never sees a button that would refuse them.
 */
export function ResetToDraftButton({ entryId }: { entryId: string }) {
  return (
    <form action={resetEntryAction}>
      <input type="hidden" name="entryId" value={entryId} />
      <ResetSubmit />
    </form>
  );
}

function ResetSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <RotateCcw className="h-3.5 w-3.5" />
      {pending ? "Resetting…" : "Reset to draft"}
    </Button>
  );
}

"use client";

import { useFormStatus } from "react-dom";
import { Undo2 } from "lucide-react";

import { Button } from "@/components/ui/primitives";
import { reverseEntryAction } from "../actions";

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

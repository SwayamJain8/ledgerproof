"use client";

import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/primitives";
import { confirmInvoiceAction } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      <CheckCircle2 className="h-3.5 w-3.5" />
      {pending ? "Posting\u2026" : "Confirm"}
    </Button>
  );
}

export function ConfirmInvoiceButton({ invoiceId }: { invoiceId: string }) {
  return (
    <form action={confirmInvoiceAction}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Submit />
    </form>
  );
}

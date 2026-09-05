"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Banknote } from "lucide-react";

import { formatINR } from "@/lib/money";
import { Button } from "@/components/ui/primitives";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { registerPaymentAction } from "@/app/(app)/payments/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Posting\u2026" : "Register payment"}
    </Button>
  );
}

/**
 * The mockup's "Register Payment" button and its little form.
 *
 * The amount defaults to the full residual but stays editable — that is the
 * entire difference between a system that can represent a partial payment and
 * one that cannot.
 */
export function RegisterPayment({
  documentType,
  documentId,
  residualPaise,
  defaultDate,
}: {
  documentType: "INVOICE" | "BILL";
  documentId: string;
  residualPaise: bigint;
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const due = (Number(residualPaise) / 100).toFixed(2);

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Banknote className="h-3.5 w-3.5" />
        Register payment
      </Button>
    );
  }

  return (
    <form
      action={registerPaymentAction}
      className="w-full rounded-md border border-walnut/25 bg-walnut-3/40 p-4"
    >
      <input type="hidden" name="documentType" value={documentType} />
      <input type="hidden" name="documentId" value={documentId} />

      <p className="mb-3 font-display text-[14px] text-ink">
        Register a payment &mdash;{" "}
        <span className="text-ink-3">{formatINR(residualPaise)} still due</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Amount" htmlFor="amount">
          <Input
            id="amount"
            name="amount"
            defaultValue={due}
            inputMode="decimal"
            className="text-right"
            required
          />
        </Field>
        <Field label="Date" htmlFor="paymentDate">
          <Input id="paymentDate" name="paymentDate" type="date" defaultValue={defaultDate} required />
        </Field>
        <Field label="Paid via" htmlFor="method">
          <Select id="method" name="method" defaultValue="BANK">
            <option value="BANK">Bank</option>
            <option value="CASH">Cash</option>
          </Select>
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Note" htmlFor="note" hint="Appears as the journal entry's reference.">
          <Textarea id="note" name="note" rows={2} className="min-h-0" />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Submit />
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <p className="ml-auto text-[11.5px] text-ink-3">
          Pay less than the full amount and the badge becomes Partial.
        </p>
      </div>
    </form>
  );
}

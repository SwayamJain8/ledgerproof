"use client";

import { useFormStatus } from "react-dom";
import { CheckCircle2, FileText } from "lucide-react";

import { Button } from "@/components/ui/primitives";
import { Input } from "@/components/ui/form";
import { confirmSalesOrderAction, createInvoiceFromOrderAction } from "../actions";

function Submit({ label, busy, icon }: { label: string; busy: string; icon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {icon}
      {pending ? busy : label}
    </Button>
  );
}

export function ConfirmOrderButton({ orderId }: { orderId: string }) {
  return (
    <form action={confirmSalesOrderAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <Submit
        label="Confirm order"
        busy="Confirming…"
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
      />
    </form>
  );
}

/**
 * The mockup's "Create Invoice" action. Goods have been received, so the
 * commitment becomes a real liability. Only the uninvoiced remainder is copied,
 * which is what keeps a partially invoiced order open for the rest.
 */
export function CreateInvoiceButton({
  orderId,
  defaultInvoiceDate,
}: {
  orderId: string;
  defaultInvoiceDate: string;
}) {
  return (
    <form action={createInvoiceFromOrderAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-ink-3">Bill date</span>
        <Input name="invoiceDate" type="date" defaultValue={defaultInvoiceDate} className="w-40" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-ink-3">Their reference</span>
        <Input name="invoiceReference" placeholder="ABC-26-001" className="w-44" />
      </label>
      <Submit
        label="Create invoice"
        busy="Creating…"
        icon={<FileText className="h-3.5 w-3.5" />}
      />
    </form>
  );
}

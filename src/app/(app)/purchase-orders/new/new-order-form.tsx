"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import {
  LineEditor,
  type EditorOption,
  type EditorProduct,
  type EditorTax,
} from "@/components/documents/line-editor";
import { createPurchaseOrderAction, type OrderFormState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending}>
      {pending ? "Saving…" : "Save draft"}
    </Button>
  );
}

export function NewPurchaseOrderForm({
  vendors,
  products,
  taxes,
  accounts,
  analytics,
  defaultOrderDate,
}: {
  vendors: { id: string; name: string }[];
  products: EditorProduct[];
  taxes: EditorTax[];
  accounts: EditorOption[];
  analytics: EditorOption[];
  defaultOrderDate: string;
}) {
  const [state, formAction] = useActionState<OrderFormState, FormData>(
    createPurchaseOrderAction,
    {},
  );

  return (
    <form action={formAction}>
      <PageHeader
        eyebrow="Purchase"
        title="New Purchase Order"
        description="An order is a commitment, not a transaction. Nothing reaches the ledger until the resulting vendor bill is confirmed."
        actions={<Submit />}
      />

      {state.error ? (
        <div className="mb-4">
          <FormError>{state.error}</FormError>
        </div>
      ) : null}

      <div className="space-y-4">
        <Panel className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Vendor" htmlFor="vendorId">
              <Select id="vendorId" name="vendorId" required defaultValue="">
                <option value="" disabled>
                  Choose a vendor&hellip;
                </option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Order date" htmlFor="orderDate">
              <Input
                id="orderDate"
                name="orderDate"
                type="date"
                defaultValue={defaultOrderDate}
                required
              />
            </Field>

            <Field label="Notes" htmlFor="notes" hint="Optional">
              <Input id="notes" name="notes" placeholder="Delivery instructions&hellip;" />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Lines"
            subtitle="Quantities here are what you commit to buy — you can bill them all at once or a few at a time"
          />
          <LineEditor
            side="PURCHASE"
            products={products}
            taxes={taxes}
            accounts={accounts}
            analytics={analytics}
          />
        </Panel>
      </div>
    </form>
  );
}

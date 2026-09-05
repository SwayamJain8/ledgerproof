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
import { createBillAction, type DocFormState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending}>
      {pending ? "Saving\u2026" : "Save draft"}
    </Button>
  );
}

export function NewBillForm({
  vendors,
  products,
  taxes,
  accounts,
  analytics,
  defaultBillDate,
  defaultDueDate,
}: {
  vendors: { id: string; name: string }[];
  products: EditorProduct[];
  taxes: EditorTax[];
  accounts: EditorOption[];
  analytics: EditorOption[];
  defaultBillDate: string;
  defaultDueDate: string;
}) {
  const [state, formAction] = useActionState<DocFormState, FormData>(createBillAction, {});

  return (
    <form action={formAction}>
      <PageHeader
        eyebrow="Purchase"
        title="New Vendor Bill"
        description="Saving creates a draft. Nothing reaches the ledger and no number is allocated until you press Confirm."
        actions={<Submit />}
      />

      {state.error ? (
        <div className="mb-4">
          <FormError>{state.error}</FormError>
        </div>
      ) : null}

      <div className="space-y-4">
        <Panel className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

            <Field
              label="Their reference"
              htmlFor="billReference"
              hint="The vendor's own number, e.g. ABC-26-001"
            >
              <Input id="billReference" name="billReference" placeholder="ABC-26-001" />
            </Field>

            <Field label="Bill date" htmlFor="billDate">
              <Input id="billDate" name="billDate" type="date" defaultValue={defaultBillDate} required />
            </Field>

            <Field label="Due date" htmlFor="dueDate">
              <Input id="dueDate" name="dueDate" type="date" defaultValue={defaultDueDate} required />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Lines"
            subtitle="Leave Account on Auto and the posting engine resolves it — product, then category, then the journal default"
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

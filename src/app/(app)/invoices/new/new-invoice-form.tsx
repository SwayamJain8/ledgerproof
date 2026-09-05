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
import { createInvoiceAction, type DocFormState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending}>
      {pending ? "Saving\u2026" : "Save draft"}
    </Button>
  );
}

export function NewInvoiceForm({
  customers,
  products,
  taxes,
  accounts,
  analytics,
  defaultInvoiceDate,
  defaultDueDate,
}: {
  customers: { id: string; name: string }[];
  products: EditorProduct[];
  taxes: EditorTax[];
  accounts: EditorOption[];
  analytics: EditorOption[];
  defaultInvoiceDate: string;
  defaultDueDate: string;
}) {
  const [state, formAction] = useActionState<DocFormState, FormData>(createInvoiceAction, {});

  return (
    <form action={formAction}>
      <PageHeader
        eyebrow="Sales"
        title="New Customer Invoice"
        description="Saving creates a draft. The invoice number and the journal entry are both created at Confirm, in one transaction — which is why the numbering has no gaps."
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
            <Field label="Customer" htmlFor="customerId">
              <Select id="customerId" name="customerId" required defaultValue="">
                <option value="" disabled>
                  Choose a customer&hellip;
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Reference" htmlFor="reference" hint="Their PO number, if any">
              <Input id="reference" name="reference" placeholder="PO-2026-114" />
            </Field>

            <Field label="Invoice date" htmlFor="invoiceDate">
              <Input
                id="invoiceDate"
                name="invoiceDate"
                type="date"
                defaultValue={defaultInvoiceDate}
                required
              />
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
            side="SALE"
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

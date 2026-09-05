"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { createContactAction, type ContactFormState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending}>
      {pending ? "Saving…" : "Save contact"}
    </Button>
  );
}

export function NewContactForm({
  receivableAccounts,
  payableAccounts,
}: {
  receivableAccounts: { id: string; label: string }[];
  payableAccounts: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState<ContactFormState, FormData>(createContactAction, {});

  return (
    <form action={formAction}>
      <PageHeader
        eyebrow="Master data"
        title="New Contact"
        description="A customer, a vendor, or both. Everything you buy from or sell to is a contact."
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
            <Field label="Name" htmlFor="name">
              <Input id="name" name="name" required autoFocus placeholder="Nimesh Pathak" />
            </Field>

            <Field label="Type" htmlFor="type" hint="Both, if they buy and supply">
              <Select id="type" name="type" defaultValue="CUSTOMER">
                <option value="CUSTOMER">Customer</option>
                <option value="VENDOR">Vendor</option>
                <option value="BOTH">Both</option>
              </Select>
            </Field>

            <Field label="Email" htmlFor="email" hint="Optional, but must be unique">
              <Input id="email" name="email" type="email" placeholder="nimesh@example.com" />
            </Field>

            <Field label="Mobile" htmlFor="mobile">
              <Input id="mobile" name="mobile" placeholder="+91 90900 90901" />
            </Field>

            <Field label="Street" htmlFor="street1">
              <Input id="street1" name="street1" placeholder="12 Ashram Road" />
            </Field>

            <Field label="City" htmlFor="city">
              <Input id="city" name="city" placeholder="Ahmedabad" />
            </Field>

            <Field label="State" htmlFor="state">
              <Input id="state" name="state" placeholder="Gujarat" />
            </Field>

            <Field label="Pincode" htmlFor="pincode">
              <Input id="pincode" name="pincode" maxLength={6} placeholder="380009" />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Control accounts"
            subtitle="Leave both blank unless this contact needs its own — the company default applies otherwise"
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field
              label="Receivable account"
              htmlFor="receivableAccountId"
              hint="Where money this customer owes is held"
            >
              <Select id="receivableAccountId" name="receivableAccountId" defaultValue="">
                <option value="">Company default</option>
                {receivableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Payable account"
              htmlFor="payableAccountId"
              hint="Where money owed to this vendor is held"
            >
              <Select id="payableAccountId" name="payableAccountId" defaultValue="">
                <option value="">Company default</option>
                {payableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>
      </div>
    </form>
  );
}

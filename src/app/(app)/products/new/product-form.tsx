"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { createProductAction, type ProductFormState } from "../actions";

type Option = { id: string; label: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending}>
      {pending ? "Saving…" : "Save product"}
    </Button>
  );
}

export function NewProductForm({
  categories,
  taxes,
  incomeAccounts,
  expenseAccounts,
}: {
  categories: Option[];
  taxes: Option[];
  incomeAccounts: Option[];
  expenseAccounts: Option[];
}) {
  const [state, formAction] = useActionState<ProductFormState, FormData>(createProductAction, {});
  const [type, setType] = useState("GOODS");
  const isService = type === "SERVICE";

  return (
    <form action={formAction}>
      <PageHeader
        eyebrow="Master data"
        title="New Product"
        description="What you buy and sell. The price here is only a default — every document line can override it."
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
              <Input id="name" name="name" required autoFocus placeholder="Wooden Table" />
            </Field>

            <Field label="Type" htmlFor="type">
              <Select
                id="type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="GOODS">Goods</option>
                <option value="SERVICE">Service</option>
                <option value="COMBO">Combo</option>
              </Select>
            </Field>

            <Field label="Category" htmlFor="categoryId" hint="Rung 3 of the account chain">
              <Select id="categoryId" name="categoryId" defaultValue="">
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Sales price" htmlFor="salesPrice" hint="Rupees, what you sell it for">
              <Input id="salesPrice" name="salesPrice" required defaultValue="0" inputMode="decimal" />
            </Field>

            <Field label="Cost" htmlFor="cost" hint="Rupees, what you pay for it">
              <Input id="cost" name="cost" required defaultValue="0" inputMode="decimal" />
            </Field>

            <Field label="Track inventory" htmlFor="trackInventory">
              <label className="flex h-8.5 items-center gap-2 text-[13px] text-ink-2">
                <input
                  id="trackInventory"
                  name="trackInventory"
                  type="checkbox"
                  defaultChecked
                  disabled={isService}
                  className="h-3.5 w-3.5 accent-walnut"
                />
                {isService ? "Not applicable to a service" : "Keep a stock ledger"}
              </label>
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Taxes"
            subtitle="Applied by default on document lines using this product"
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Sales tax" htmlFor="salesTaxId">
              <Select id="salesTaxId" name="salesTaxId" defaultValue="">
                <option value="">None</option>
                {taxes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Purchase tax" htmlFor="purchaseTaxId">
              <Select id="purchaseTaxId" name="purchaseTaxId" defaultValue="">
                <option value="">None</option>
                {taxes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Accounts"
            subtitle="Leave blank and the category is tried next, then the journal default — that chain is what the Explain panel shows"
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Income account" htmlFor="incomeAccountId" hint="Used when you sell it">
              <Select id="incomeAccountId" name="incomeAccountId" defaultValue="">
                <option value="">Inherit from category</option>
                {incomeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Expense account" htmlFor="expenseAccountId" hint="Used when you buy it">
              <Select id="expenseAccountId" name="expenseAccountId" defaultValue="">
                <option value="">Inherit from category</option>
                {expenseAccounts.map((a) => (
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

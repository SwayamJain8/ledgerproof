"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, PageHeader, Panel } from "@/components/ui/primitives";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { createAnalyticAction, type AnalyticFormState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending}>
      {pending ? "Saving\u2026" : "Save analytic account"}
    </Button>
  );
}

export function NewAnalyticForm() {
  const [state, formAction] = useActionState<AnalyticFormState, FormData>(createAnalyticAction, {});

  return (
    <form action={formAction}>
      <PageHeader
        eyebrow="Master data"
        title="New Analytic Account"
        description="A second dimension on top of the chart of accounts — a project, a department, a campaign. Tag document lines with it and a budget can read its actuals straight from the ledger."
        actions={<Submit />}
      />

      {state.error ? (
        <div className="mb-4">
          <FormError>{state.error}</FormError>
        </div>
      ) : null}

      <Panel className="p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" required autoFocus placeholder="Showroom Fitout" />
          </Field>
          <Field label="Code" htmlFor="code" hint="Optional short code">
            <Input id="code" name="code" maxLength={16} placeholder="FIT" />
          </Field>
          <Field label="Type" htmlFor="type" hint="Expense for spending, Income for revenue">
            <Select id="type" name="type" defaultValue="EXPENSE">
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </Select>
          </Field>
        </div>
      </Panel>
    </form>
  );
}

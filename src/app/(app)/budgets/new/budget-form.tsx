"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { createBudgetAction, type BudgetFormState } from "../actions";

type Option = { id: string; label: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending}>
      {pending ? "Saving\u2026" : "Save budget"}
    </Button>
  );
}

export function NewBudgetForm({
  analytics,
  people,
  defaultStart,
  defaultEnd,
}: {
  analytics: Option[];
  people: Option[];
  defaultStart: string;
  defaultEnd: string;
}) {
  const [state, formAction] = useActionState<BudgetFormState, FormData>(createBudgetAction, {});

  return (
    <form action={formAction}>
      <PageHeader
        eyebrow="Master data"
        title="New Budget"
        description="A plan for one analytic account over one period. Only the planned figure is stored \u2014 what you actually spent is summed from the ledger every time you look."
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
            <Field label="Name" htmlFor="name">
              <Input id="name" name="name" required autoFocus placeholder="Showroom Fitout Q1" />
            </Field>
            <Field label="Starts" htmlFor="startDate">
              <Input id="startDate" name="startDate" type="date" defaultValue={defaultStart} required />
            </Field>
            <Field label="Ends" htmlFor="endDate">
              <Input id="endDate" name="endDate" type="date" defaultValue={defaultEnd} required />
            </Field>
            <Field label="Responsible" htmlFor="responsibleId" hint="Optional">
              <Select id="responsibleId" name="responsibleId" defaultValue="">
                <option value="">Nobody</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="What is being budgeted"
            subtitle="Tag document lines with this analytic account and they count towards the figure automatically"
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Analytic account" htmlFor="analyticAccountId">
              <Select id="analyticAccountId" name="analyticAccountId" required defaultValue="">
                <option value="" disabled>
                  Choose one&hellip;
                </option>
                {analytics.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Planned amount" htmlFor="committed" hint="Rupees">
              <Input id="committed" name="committed" required inputMode="decimal" placeholder="100000" />
            </Field>
          </div>
        </Panel>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";

import { Button, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { createJournalEntryAction, type EntryFormState } from "../actions";

type Option = { id: string; label: string };

interface Row {
  accountId: string;
  label: string;
  partnerId: string;
  analyticAccountId: string;
  debit: string;
  credit: string;
}

const blank = (): Row => ({
  accountId: "",
  label: "",
  partnerId: "",
  analyticAccountId: "",
  debit: "",
  credit: "",
});

const paise = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

const inr = (p: number) =>
  `Rs. ${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Submit({ balanced }: { balanced: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending || !balanced}>
      {pending ? "Posting…" : balanced ? "Post entry" : "Debits must equal credits"}
    </Button>
  );
}

/**
 * The manual journal entry grid.
 *
 * Two things it does that matter: it will not let you type a debit AND a credit
 * on the same line, and the Post button stays disabled until the two columns
 * agree. The database enforces both anyway — this is just telling the user
 * before the server has to.
 */
export function NewEntryForm({
  journals,
  accounts,
  partners,
  analytics,
  defaultDate,
}: {
  journals: Option[];
  accounts: Option[];
  partners: Option[];
  analytics: Option[];
  defaultDate: string;
}) {
  const [state, formAction] = useActionState<EntryFormState, FormData>(
    createJournalEntryAction,
    {},
  );
  const [rows, setRows] = useState<Row[]>([blank(), blank()]);

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + paise(r.debit), 0);
    const credit = rows.reduce((s, r) => s + paise(r.credit), 0);
    const filled = rows.filter((r) => r.accountId && (paise(r.debit) > 0 || paise(r.credit) > 0));
    return {
      debit,
      credit,
      difference: debit - credit,
      balanced: debit === credit && debit > 0 && filled.length >= 2,
    };
  }, [rows]);

  const set = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <form action={formAction}>
      <input type="hidden" name="lines" value={JSON.stringify(rows)} />

      <PageHeader
        eyebrow="Accounting"
        title="New Journal Entry"
        description="Record something by hand — opening capital, rent, a correction. This is the same engine every invoice and bill goes through, so whatever you post here shows up in every report."
        actions={<Submit balanced={totals.balanced} />}
      />

      {state.error ? (
        <div className="mb-4">
          <FormError>{state.error}</FormError>
        </div>
      ) : null}

      <div className="space-y-4">
        <Panel className="p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Journal" htmlFor="journalId">
              <Select id="journalId" name="journalId" required defaultValue="">
                <option value="" disabled>
                  Choose a journal&hellip;
                </option>
                {journals.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Date" htmlFor="date" hint="The accounting date, not today">
              <Input id="date" name="date" type="date" defaultValue={defaultDate} required />
            </Field>

            <Field label="Reference" htmlFor="ref" hint="What this is for">
              <Input id="ref" name="ref" placeholder="Owner capital introduced" />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Lines"
            subtitle="Every line is either a debit or a credit. The two columns must add up to the same figure."
            actions={
              <Button type="button" size="sm" onClick={() => setRows((p) => [...p, blank()])}>
                <Plus className="h-3 w-3" />
                Add line
              </Button>
            }
          />

          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="w-8 border-b border-rule-2 bg-surface-2 px-3 py-2 text-left text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                    #
                  </th>
                  <th className="border-b border-rule-2 bg-surface-2 px-3 py-2 text-left text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                    Account
                  </th>
                  <th className="border-b border-rule-2 bg-surface-2 px-3 py-2 text-left text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                    Description
                  </th>
                  <th className="border-b border-rule-2 bg-surface-2 px-3 py-2 text-left text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                    Contact
                  </th>
                  <th className="border-b border-rule-2 bg-surface-2 px-3 py-2 text-left text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                    Analytic
                  </th>
                  <th className="w-32 border-b border-rule-2 bg-surface-2 px-3 py-2 text-right text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                    Debit
                  </th>
                  <th className="w-32 border-b border-rule-2 bg-surface-2 px-3 py-2 text-right text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                    Credit
                  </th>
                  <th className="w-10 border-b border-rule-2 bg-surface-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="border-b border-rule px-3 py-1.5 text-ink-3">{i + 1}</td>
                    <td className="border-b border-rule px-3 py-1.5">
                      <Select
                        value={row.accountId}
                        onChange={(e) => set(i, { accountId: e.target.value })}
                        aria-label={`Account for line ${i + 1}`}
                      >
                        <option value="">Choose…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="border-b border-rule px-3 py-1.5">
                      <Input
                        value={row.label}
                        onChange={(e) => set(i, { label: e.target.value })}
                        placeholder="Optional"
                        aria-label={`Description for line ${i + 1}`}
                      />
                    </td>
                    <td className="border-b border-rule px-3 py-1.5">
                      <Select
                        value={row.partnerId}
                        onChange={(e) => set(i, { partnerId: e.target.value })}
                        aria-label={`Contact for line ${i + 1}`}
                      >
                        <option value="">None</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="border-b border-rule px-3 py-1.5">
                      <Select
                        value={row.analyticAccountId}
                        onChange={(e) => set(i, { analyticAccountId: e.target.value })}
                        aria-label={`Analytic for line ${i + 1}`}
                      >
                        <option value="">None</option>
                        {analytics.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="border-b border-rule px-3 py-1.5">
                      <Input
                        value={row.debit}
                        inputMode="decimal"
                        className="text-right tabular-nums"
                        // Typing in one column clears the other: a line is one or
                        // the other, and CHECK journal_item_one_sided agrees.
                        onChange={(e) => set(i, { debit: e.target.value, credit: "" })}
                        aria-label={`Debit for line ${i + 1}`}
                      />
                    </td>
                    <td className="border-b border-rule px-3 py-1.5">
                      <Input
                        value={row.credit}
                        inputMode="decimal"
                        className="text-right tabular-nums"
                        onChange={(e) => set(i, { credit: e.target.value, debit: "" })}
                        aria-label={`Credit for line ${i + 1}`}
                      />
                    </td>
                    <td className="border-b border-rule px-1 py-1.5">
                      {rows.length > 2 ? (
                        <button
                          type="button"
                          onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
                          className="rounded p-1 text-ink-4 transition-colors hover:text-oxide"
                          aria-label={`Remove line ${i + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2">
                  <td colSpan={5} className="px-3 py-2 text-right text-[12px] font-medium text-ink-2">
                    Totals
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {inr(totals.debit)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {inr(totals.credit)}
                  </td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={8} className="px-3 py-2">
                    {totals.balanced ? (
                      <p className="text-[12.5px] text-ledger">
                        Balanced. Debits equal credits, so this entry can be posted.
                      </p>
                    ) : (
                      <p className="text-[12.5px] text-ink-3">
                        {totals.debit === 0 && totals.credit === 0
                          ? "Enter at least two lines — something given, and something received."
                          : `Out by ${inr(Math.abs(totals.difference))}. The database will refuse an unbalanced entry, so the button stays disabled until this is zero.`}
                      </p>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>
      </div>
    </form>
  );
}

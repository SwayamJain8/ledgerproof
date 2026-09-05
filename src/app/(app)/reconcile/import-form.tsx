"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/primitives";
import { FormError, Textarea } from "@/components/ui/form";
import { importStatementAction, type ImportState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      <Upload className="h-3.5 w-3.5" />
      {pending ? "Reading…" : "Import statement"}
    </Button>
  );
}

export function ImportStatementForm() {
  const [state, formAction] = useActionState<ImportState, FormData>(importStatementAction, {});

  return (
    <form action={formAction} className="space-y-3 p-4">
      {state.error ? <FormError>{state.error}</FormError> : null}

      {state.imported ? (
        <p className="rounded-md border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
          Imported {state.imported} line{state.imported === 1 ? "" : "s"}.
          {state.skipped && state.skipped.length > 0 ? (
            <>
              {" "}
              <span className="text-ink-3">
                {state.skipped.length} row{state.skipped.length === 1 ? "" : "s"} skipped:{" "}
                {state.skipped.slice(0, 3).join(" ")}
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <Textarea
          name="csv"
          rows={4}
          placeholder={"Date,Narration,Amount\n15/09/2026,NEFT/N PATHAK/INV-2026-0007,47200.00"}
          className="font-mono text-[12px]"
        />
        <div className="flex flex-col justify-between gap-3">
          <label className="text-[12px] text-ink-3">
            <span className="mb-1 block">…or choose a file</span>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              className="block w-full text-[12px] text-ink-3 file:mr-2 file:rounded-md file:border file:border-line file:bg-surface-2 file:px-2 file:py-1 file:text-[12px] file:text-ink-2"
            />
          </label>
          <Submit />
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-3">
        Accepts a signed <span className="font-mono">Amount</span> column, or a separate{" "}
        <span className="font-mono">Debit</span>/<span className="font-mono">Credit</span> pair.
        Dates may be <span className="font-mono">DD/MM/YYYY</span> or{" "}
        <span className="font-mono">YYYY-MM-DD</span>. A row that cannot be read is reported, never
        silently dropped.
      </p>
    </form>
  );
}

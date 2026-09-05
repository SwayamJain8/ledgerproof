"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Money } from "@/components/ui/money";
import { cn } from "@/components/ui/cn";

export interface TraceRow {
  rung: string;
  source: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  amountPaise: string;
  label?: string;
}

const CHAIN_NAMES: Record<string, string> = {
  R1: "Revenue account",
  R2: "Expense account",
  R3: "Tax account",
  R4: "Counterparty account",
  R5: "Money account",
};

const RUNG_MEANING: Record<string, string> = {
  "1": "the line's own override",
  "2": "the product",
  "3": "the product category",
  "4": "the journal default",
};

/**
 * "Explain this entry."
 *
 * Every posted entry stores the trace the resolution chains produced while
 * building it. This panel renders it verbatim. It answers the only question
 * anyone actually has about a posting engine — "where did that account come
 * from?" — with the exact column that supplied the answer.
 */
export function ExplainPanel({ trace }: { trace: TraceRow[] }) {
  const [open, setOpen] = useState(false);

  if (trace.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-md border border-brass/25 bg-brass-2/40">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-brass-2/70"
        aria-expanded={open}
      >
        <span>
          <span className="block font-display text-[14px] text-ink">Explain this entry</span>
          <span className="mt-0.5 block text-[12px] text-ink-3">
            Which configuration produced each account, rung by rung
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="border-t border-brass/20 bg-surface/70 px-4 py-3">
          <ol className="space-y-2.5">
            {trace.map((row, index) => {
              const [chain, rung] = row.rung.split(".");
              return (
                <li key={`${row.rung}-${index}`} className="flex gap-3 text-[12.5px]">
                  <span className="tnum mt-px shrink-0 rounded-sm border border-brass/30 bg-surface px-1.5 py-0.5 text-[10.5px] font-semibold text-amber">
                    {row.rung}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">
                      <span className="font-medium">{CHAIN_NAMES[chain] ?? chain}</span>
                      <span className="text-ink-3"> resolved from {RUNG_MEANING[rung] ?? "configuration"} to </span>
                      <span className="font-medium">
                        {row.accountCode} {row.accountName}
                      </span>
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-4">{row.source}</p>
                  </div>
                  <span className="shrink-0 text-ink-2">
                    <Money paise={BigInt(row.amountPaise)} />
                  </span>
                </li>
              );
            })}
          </ol>

          <p className="mt-3 border-t border-rule pt-3 text-[11.5px] leading-relaxed text-ink-3">
            Rungs are tried in order and the first non-null wins. Nothing in the engine names an
            account — change any of the columns listed above and the next document posts
            differently.
          </p>
        </div>
      ) : null}
    </div>
  );
}

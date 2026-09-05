"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { formatINR } from "@/lib/money";
import { Button, Th, Td } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/form";

export interface EditorProduct {
  id: string;
  name: string;
  salesPricePaise: string;
  costPaise: string;
  salesTaxId: string | null;
  purchaseTaxId: string | null;
}

export interface EditorTax {
  id: string;
  name: string;
  rateBp: number;
}

export interface EditorOption {
  id: string;
  label: string;
}

export interface DraftLine {
  key: string;
  productId: string;
  description: string;
  accountId: string;
  analyticAccountId: string;
  qty: string;
  unitPrice: string;
  taxId: string;
}

/* Arithmetic mirrored from src/lib/money.ts. The server recomputes everything
   and a CHECK constraint validates it -- this is purely so the user sees the
   total move as they type. */
const MILLI = 1000n;
const divRoundHalfUp = (n: bigint, d: bigint) => (n * 2n + d) / (d * 2n);

function toPaise(rupees: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(rupees.trim());
  if (!match) return 0n;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "0").padEnd(2, "0"));
}

function toMilli(qty: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(qty.trim());
  if (!match) return 0n;
  return BigInt(match[1]) * MILLI + BigInt((match[2] ?? "0").padEnd(3, "0"));
}

let counter = 0;
const emptyLine = (): DraftLine => ({
  key: `line-${++counter}`,
  productId: "",
  description: "",
  accountId: "",
  analyticAccountId: "",
  qty: "1",
  unitPrice: "0",
  taxId: "",
});

export function LineEditor({
  side,
  products,
  taxes,
  accounts,
  analytics,
}: {
  side: "SALE" | "PURCHASE";
  products: EditorProduct[];
  taxes: EditorTax[];
  accounts: EditorOption[];
  analytics: EditorOption[];
}) {
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  /** Picking a product fills price and tax from the product record. */
  const pickProduct = (key: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return update(key, { productId });
    const paise = side === "SALE" ? product.salesPricePaise : product.costPaise;
    update(key, {
      productId,
      description: product.name,
      unitPrice: (Number(paise) / 100).toFixed(2),
      taxId: (side === "SALE" ? product.salesTaxId : product.purchaseTaxId) ?? "",
    });
  };

  const computed = useMemo(
    () =>
      lines.map((line) => {
        const subtotal = divRoundHalfUp(toMilli(line.qty) * toPaise(line.unitPrice), MILLI);
        const rate = taxes.find((t) => t.id === line.taxId)?.rateBp ?? 0;
        const tax = rate ? divRoundHalfUp(subtotal * BigInt(rate), 10_000n) : 0n;
        return { subtotal, tax };
      }),
    [lines, taxes],
  );

  const untaxed = computed.reduce((s, c) => s + c.subtotal, 0n);
  // Summed per line, never computed on the total -- see docs/ENGINE.md §3.
  const taxTotal = computed.reduce((s, c) => s + c.tax, 0n);

  return (
    <>
      {/* The Server Action reads this; the visible controls are unnamed. */}
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          lines
            .filter((line) => line.productId)
            .map((line) => ({
              productId: line.productId,
              description: line.description,
              accountId: line.accountId || null,
              analyticAccountId: line.analyticAccountId || null,
              qty: line.qty,
              unitPrice: line.unitPrice,
              taxId: line.taxId || null,
            })),
        )}
      />

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <Th className="w-10">#</Th>
              <Th className="min-w-[13rem]">Product</Th>
              <Th className="min-w-[11rem]">
                Account
                <span className="ml-1 font-normal normal-case" title="Leave on Auto to let the posting engine resolve it">
                  (auto)
                </span>
              </Th>
              <Th className="min-w-[9rem]">Analytic</Th>
              <Th numeric className="w-24">
                Qty
              </Th>
              <Th numeric className="w-32">
                Unit price
              </Th>
              <Th className="w-32">Tax</Th>
              <Th numeric className="w-32">
                Subtotal
              </Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.key}>
                <Td className="tnum text-ink-4">{index + 1}</Td>
                <Td>
                  <Select
                    value={line.productId}
                    onChange={(e) => pickProduct(line.key, e.target.value)}
                    aria-label="Product"
                  >
                    <option value="">Select a product&hellip;</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Select
                    value={line.accountId}
                    onChange={(e) => update(line.key, { accountId: e.target.value })}
                    aria-label="Account override"
                  >
                    <option value="">Auto &mdash; resolve from config</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Select
                    value={line.analyticAccountId}
                    onChange={(e) => update(line.key, { analyticAccountId: e.target.value })}
                    aria-label="Analytic account"
                  >
                    <option value="">None</option>
                    {analytics.map((analytic) => (
                      <option key={analytic.id} value={analytic.id}>
                        {analytic.label}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Input
                    value={line.qty}
                    onChange={(e) => update(line.key, { qty: e.target.value })}
                    className="text-right"
                    inputMode="decimal"
                    aria-label="Quantity"
                  />
                </Td>
                <Td>
                  <Input
                    value={line.unitPrice}
                    onChange={(e) => update(line.key, { unitPrice: e.target.value })}
                    className="text-right"
                    inputMode="decimal"
                    aria-label="Unit price"
                  />
                </Td>
                <Td>
                  <Select
                    value={line.taxId}
                    onChange={(e) => update(line.key, { taxId: e.target.value })}
                    aria-label="Tax"
                  >
                    <option value="">No tax</option>
                    {taxes.map((tax) => (
                      <option key={tax.id} value={tax.id}>
                        {tax.name}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td numeric className="tnum font-medium text-ink">
                  {formatINR(computed[index].subtotal, { symbol: false })}
                </Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => setLines((c) => (c.length === 1 ? c : c.filter((l) => l.key !== line.key)))}
                    className="rounded p-1 text-ink-4 transition-colors hover:bg-oxide-2 hover:text-oxide disabled:opacity-30"
                    disabled={lines.length === 1}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 border-t border-rule px-4 py-3">
        <Button type="button" size="sm" onClick={() => setLines((c) => [...c, emptyLine()])}>
          <Plus className="h-3.5 w-3.5" />
          Add a line
        </Button>

        <dl className="w-56 space-y-1.5 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-ink-3">Untaxed</dt>
            <dd className="tnum">{formatINR(untaxed, { symbol: false })}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-3">Tax</dt>
            <dd className="tnum">{formatINR(taxTotal, { symbol: false })}</dd>
          </div>
          <div className="rule-total flex justify-between pt-1.5">
            <dt className="font-medium text-ink">Total</dt>
            <dd className="tnum font-semibold">{formatINR(untaxed + taxTotal)}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}

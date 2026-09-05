import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { profitAndLoss } from "@/lib/reports/profit-loss";
import { currentFiscalYear, formatDate, toIsoDate } from "@/lib/app-context";
import { accountingDate } from "@/lib/accounting/dates";
import { Money } from "@/components/ui/money";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { PrintButton } from "@/components/report-frame";
import type { PLRow } from "@/lib/reports/profit-loss";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profit & Loss" };

function Row({ row, negate }: { row: PLRow; negate?: boolean }) {
  return (
    <div className="border-b border-rule py-1">
      <div className="flex items-baseline justify-between gap-4 py-1">
        <p className="text-[13px] font-medium text-ink">{row.label}</p>
        <p className={`text-[13px] font-medium ${negate ? "text-oxide" : ""}`}>
          {negate ? "(" : ""}
          <Money paise={row.amountPaise} dashZero={false} className={negate ? "text-oxide" : ""} />
          {negate ? ")" : ""}
        </p>
      </div>
      {row.accounts.length > 0 ? (
        <div className="pb-1 pl-3">
          {row.accounts.map((account) => (
            <div key={account.accountId} className="flex items-baseline justify-between gap-4 py-[3px]">
              <Link
                href={`/reports/ledger/${account.accountId}`}
                className="text-[12.5px] text-ink-3 transition-colors hover:text-walnut hover:underline"
              >
                <span className="tnum text-ink-4">{account.code}</span> {account.name}
              </Link>
              <span className="text-[12.5px] text-ink-2">
                <Money paise={account.balancePaise} />
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const fy = currentFiscalYear();
  const from = params.from ? accountingDate(params.from) : fy.start;
  const to = params.to ? accountingDate(params.to) : fy.end < new Date() ? fy.end : fy.end;

  const company = await prisma.companySettings.findUnique({ where: { id: 1 } });
  const pl = await profitAndLoss(prisma, { from, to });

  const profitable = pl.netIncomePaise >= 0n;

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Profit &amp; Loss"
        description={`What was earned and what it cost between ${formatDate(from)} and ${formatDate(to)}. Accrual basis — revenue is recognised when the invoice posts, not when the money arrives.`}
        actions={
          <>
            <form className="no-print flex flex-wrap items-center gap-2">
              <label htmlFor="from" className="label-caps">
                From
              </label>
              <input
                id="from"
                type="date"
                name="from"
                defaultValue={toIsoDate(from)}
                className="h-8.5 rounded-md border border-rule-2 bg-surface px-2.5 text-[13px]"
              />
              <label htmlFor="to" className="label-caps">
                To
              </label>
              <input
                id="to"
                type="date"
                name="to"
                defaultValue={toIsoDate(to)}
                className="h-8.5 rounded-md border border-rule-2 bg-surface px-2.5 text-[13px]"
              />
              <button
                type="submit"
                className="h-8.5 rounded-md border border-rule-2 bg-surface px-3 text-[13px] transition-colors hover:bg-surface-2"
              >
                Apply
              </button>
            </form>
            <PrintButton />
          </>
        }
      />

      <div className="mb-4 hidden text-center print:block">
        <p className="font-display text-lg">{company?.name ?? "Urban Furniture"}</p>
        <p className="font-display text-2xl">Profit &amp; Loss</p>
        <p className="text-sm">
          {formatDate(from)} to {formatDate(to)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Panel className="px-4 pb-4">
          <h2 className="border-b border-ink pt-4 pb-2 font-display text-[15px] text-ink">Income</h2>
          <Row row={pl.income} />

          <h2 className="mt-6 border-b border-ink pb-2 font-display text-[15px] text-ink">
            Expenses
          </h2>
          {pl.expenseRows.map((row) => (
            <Row key={row.label} row={row} negate />
          ))}
          <div className="flex items-baseline justify-between gap-4 border-b border-rule py-2">
            <p className="text-[13px] font-medium text-ink">Total expenses</p>
            <p className="text-[13px] font-medium text-oxide">
              (<Money paise={pl.expenses.amountPaise} dashZero={false} className="text-oxide" />)
            </p>
          </div>

          <div className="rule-total mt-4 flex items-baseline justify-between gap-4 py-2.5">
            <p className="font-display text-[16px] text-ink">
              {profitable ? "Net profit" : "Net loss"}
            </p>
            <p className="text-[16px]">
              <Money
                paise={pl.netIncomePaise}
                emphasis
                dashZero={false}
                className={profitable ? "text-ledger" : "text-oxide"}
              />
            </p>
          </div>
        </Panel>

        <aside className="space-y-4">
          <Panel className="p-4">
            <p className="label-caps mb-3">How this figure is used</p>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              This net figure is what the Balance Sheet shows as{" "}
              <strong className="font-medium text-ink">Current Year Earnings</strong>. It is not
              stored anywhere — the Balance Sheet recomputes it from the same journal items every
              time it is opened, which is why the accounting equation closes without a plug.
            </p>
            <Link
              href="/reports/balance-sheet"
              className="mt-3 inline-block text-[12.5px] font-medium text-walnut hover:underline"
            >
              Open the Balance Sheet &rarr;
            </Link>
          </Panel>

          <Panel className="p-4">
            <p className="label-caps mb-3">Margin</p>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-3">Income</dt>
                <dd>
                  <Money paise={pl.income.amountPaise} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-3">Expenses</dt>
                <dd>
                  <Money paise={pl.expenses.amountPaise} />
                </dd>
              </div>
              <div className="flex justify-between border-t border-rule pt-2">
                <dt className="text-ink-3">Net margin</dt>
                <dd className="tnum font-medium">
                  {pl.income.amountPaise === 0n
                    ? "\u2014"
                    : `${((Number(pl.netIncomePaise) / Number(pl.income.amountPaise)) * 100).toFixed(1)}%`}
                </dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </div>
    </>
  );
}

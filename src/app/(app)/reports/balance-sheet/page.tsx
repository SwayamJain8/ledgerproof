import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { balanceSheet } from "@/lib/reports/balance-sheet";
import { formatDate, today, toIsoDate } from "@/lib/app-context";
import { accountingDate } from "@/lib/accounting/dates";
import { Money } from "@/components/ui/money";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { PrintButton } from "@/components/report-frame";
import type { BSRow } from "@/lib/reports/balance-sheet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Balance Sheet" };

function Section({ heading, rows, total }: { heading: string; rows: BSRow[]; total: bigint }) {
  return (
    <div>
      <h2 className="border-b border-ink px-4 pt-4 pb-2 font-display text-[15px] text-ink">
        {heading}
      </h2>

      <dl className="px-4 py-1">
        {rows.map((row) => (
          <div key={row.label} className="border-b border-rule py-1">
            <div className="flex items-baseline justify-between gap-4 py-1">
              <dt className="text-[13px] font-medium text-ink">
                {row.label}
                {row.derived ? (
                  <span
                    className="ml-2 text-[10.5px] font-semibold tracking-wide text-brass uppercase"
                    title="Computed from the Profit & Loss, not read from an account balance"
                  >
                    Derived
                  </span>
                ) : null}
              </dt>
              <dd className="text-[13px] font-medium">
                <Money paise={row.amountPaise} dashZero={false} />
              </dd>
            </div>

            {/* The accounts behind the row, each a link into its ledger. */}
            {row.accounts.length > 0 ? (
              <div className="pb-1 pl-3">
                {row.accounts.map((account) => (
                  <div
                    key={account.accountId}
                    className="flex items-baseline justify-between gap-4 py-[3px]"
                  >
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
        ))}

        <div className="rule-total mt-2 flex items-baseline justify-between gap-4 py-2">
          <dt className="text-[13px] font-semibold text-ink">Total {heading}</dt>
          <dd className="text-[14px]">
            <Money paise={total} emphasis dashZero={false} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const params = await searchParams;
  const asOf = params.asOf ? accountingDate(params.asOf) : today();

  const company = await prisma.companySettings.findUnique({ where: { id: 1 } });
  const bs = await balanceSheet(prisma, {
    asOf,
    fiscalYearStartMonth: company?.fiscalYearStartMonth ?? 4,
  });

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Balance Sheet"
        description={`What the business owns and owes as at ${formatDate(asOf)}. Every figure is summed from posted journal items.`}
        actions={
          <>
            <form className="no-print flex items-center gap-2">
              <label htmlFor="asOf" className="label-caps">
                As at
              </label>
              <input
                id="asOf"
                type="date"
                name="asOf"
                defaultValue={toIsoDate(asOf)}
                className="h-8.5 rounded-md border border-rule-2 bg-surface px-2.5 text-[13px] text-ink"
              />
              <button
                type="submit"
                className="h-8.5 rounded-md border border-rule-2 bg-surface px-3 text-[13px] text-ink transition-colors hover:bg-surface-2"
              >
                Apply
              </button>
            </form>
            <PrintButton />
          </>
        }
      />

      {/* Printed reports need their own heading; the screen chrome is stripped. */}
      <div className="mb-4 hidden text-center print:block">
        <p className="font-display text-lg">{company?.name ?? "Urban Furniture"}</p>
        <p className="font-display text-2xl">Balance Sheet</p>
        <p className="text-sm">as at {formatDate(asOf)}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <Section heading="Assets" rows={bs.assets} total={bs.totalAssetsPaise} />
        </Panel>
        <Panel>
          <Section
            heading="Liabilities & Capital"
            rows={bs.liabilities}
            total={bs.totalLiabilitiesPaise}
          />
        </Panel>
      </div>

      {/* The verdict. This is the whole report in one line. */}
      <div
        className={`mt-4 flex flex-wrap items-center justify-between gap-4 rounded-md border px-4 py-3 ${
          bs.balanced
            ? "border-ledger/25 bg-ledger-2/60"
            : "border-oxide/30 bg-oxide-2"
        }`}
      >
        <div>
          <p
            className={`font-display text-[15px] ${bs.balanced ? "text-ledger" : "text-oxide"}`}
          >
            {bs.balanced
              ? "Assets equal Liabilities and Capital"
              : "The balance sheet does not balance"}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-3">
            {bs.balanced
              ? "Current Year Earnings is computed from the Profit & Loss, which is why the equation closes."
              : "This should be impossible — every posted entry balances. Check the Books Integrity report."}
          </p>
        </div>
        <p className="text-[13px] text-ink-2">
          Difference <Money paise={bs.differencePaise} dashZero={false} emphasis />
        </p>
      </div>
    </>
  );
}

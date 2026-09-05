import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { accountBalances, trialBalance } from "@/lib/reports/ledger";
import { ACCOUNT_TYPE_META } from "@/lib/accounting/account-type";
import { formatDate, today, toIsoDate } from "@/lib/app-context";
import { accountingDate } from "@/lib/accounting/dates";
import { Money } from "@/components/ui/money";
import { PageHeader, Panel, Table, Td, Th } from "@/components/ui/primitives";
import { PrintButton } from "@/components/report-frame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trial Balance" };

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const params = await searchParams;
  const asOf = params.asOf ? accountingDate(params.asOf) : today();

  const [company, balances, tb] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 1 } }),
    accountBalances(prisma, { to: asOf }),
    trialBalance(prisma, asOf),
  ]);

  const rows = balances.filter((b) => b.debitPaise !== 0n || b.creditPaise !== 0n);

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Trial Balance"
        description="Every posted debit and every posted credit, per account. If the two columns do not agree, nothing else in the system can be trusted — which is why this is the first report to check."
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
        <p className="font-display text-2xl">Trial Balance</p>
        <p className="text-sm">as at {formatDate(asOf)}</p>
      </div>

      <Panel>
        <Table>
          <thead>
            <tr>
              <Th className="w-20">Code</Th>
              <Th>Account</Th>
              <Th className="w-36">Type</Th>
              <Th numeric className="w-40">
                Debit
              </Th>
              <Th numeric className="w-40">
                Credit
              </Th>
              <Th numeric className="w-40">
                Balance
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.accountId} className="transition-colors hover:bg-surface-2">
                <Td className="tnum text-ink-3">{row.code}</Td>
                <Td>
                  <Link
                    href={`/reports/ledger/${row.accountId}`}
                    className="font-medium text-ink hover:text-walnut hover:underline"
                  >
                    {row.name}
                  </Link>
                </Td>
                <Td className="text-[12px] text-ink-3">{ACCOUNT_TYPE_META[row.type].label}</Td>
                <Td numeric>
                  <Money paise={row.debitPaise} />
                </Td>
                <Td numeric>
                  <Money paise={row.creditPaise} />
                </Td>
                <Td numeric className="font-medium">
                  <Money paise={row.balancePaise} />
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <Td colSpan={3} className="rule-total font-semibold text-ink">
                Total
              </Td>
              <Td numeric className="rule-total">
                <Money paise={tb.debitPaise} emphasis dashZero={false} />
              </Td>
              <Td numeric className="rule-total">
                <Money paise={tb.creditPaise} emphasis dashZero={false} />
              </Td>
              <Td numeric className="rule-total">
                <Money paise={tb.differencePaise} dashZero={false} />
              </Td>
            </tr>
          </tfoot>
        </Table>
      </Panel>

      <div
        className={`mt-4 rounded-md border px-4 py-3 ${
          tb.balanced ? "border-ledger/25 bg-ledger-2/60" : "border-oxide/30 bg-oxide-2"
        }`}
      >
        <p className={`font-display text-[15px] ${tb.balanced ? "text-ledger" : "text-oxide"}`}>
          {tb.balanced ? "The trial balance ties" : "The trial balance does not tie"}
        </p>
        <p className="mt-0.5 text-[12px] text-ink-3">
          {tb.itemCount} journal items across {tb.entryCount} entries, with a difference of{" "}
          <Money paise={tb.differencePaise} dashZero={false} /> between total debits and total
          credits.
        </p>
      </div>
    </>
  );
}

import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { accountBalances } from "@/lib/reports/ledger";
import { ACCOUNT_TYPE_META } from "@/lib/accounting/account-type";
import { today } from "@/lib/app-context";
import { Money } from "@/components/ui/money";
import { Badge, PageHeader, Panel, Table, Td, Th } from "@/components/ui/primitives";
import type { AccountType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chart of Accounts" };

/** The two report sections, each with its types in the order a report prints them. */
const SECTIONS: { heading: string; blurb: string; types: AccountType[] }[] = [
  {
    heading: "Balance Sheet",
    blurb: "Cumulative balances, carried forward year on year",
    types: ["BANK", "CASH", "ASSET", "LIABILITY", "CAPITAL"],
  },
  {
    heading: "Profit & Loss",
    blurb: "Reset every fiscal year into Retained Earnings",
    types: ["INCOME", "EXPENSE", "OTHER_EXPENSE"],
  },
];

const SUBTYPE_LABELS: Record<string, string> = {
  RECEIVABLE: "Receivable",
  PAYABLE: "Payable",
  TAX_COLLECTED: "Output tax",
  TAX_PAID: "Input tax",
  INVENTORY: "Inventory",
  COGS: "Cost of goods sold",
  RETAINED_EARNINGS: "Retained earnings",
  CURRENT_YEAR_EARNINGS: "Current year earnings",
  ROUNDING: "Rounding difference",
};

export default async function AccountsPage() {
  const asOf = today();
  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({ orderBy: { code: "asc" } }),
    accountBalances(prisma, { to: asOf }),
  ]);
  const balanceByAccount = new Map(balances.map((b) => [b.accountId, b.balancePaise]));

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Chart of Accounts"
        description="Each account carries a type, and the type alone decides which report it appears in and which direction counts as positive. Reports never match an account by name — rename any of these and the Balance Sheet still finds it."
      />

      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const rows = section.types.flatMap((type) =>
            accounts.filter((account) => account.type === type),
          );

          return (
            <Panel key={section.heading}>
              <div className="flex items-baseline justify-between border-b border-rule px-4 py-3">
                <div>
                  <h2 className="font-display text-[15px] text-ink">{section.heading}</h2>
                  <p className="mt-0.5 text-xs text-ink-3">{section.blurb}</p>
                </div>
                <p className="text-xs text-ink-3">{rows.length} accounts</p>
              </div>

              <Table>
                <thead>
                  <tr>
                    <Th className="w-20">Code</Th>
                    <Th>Account</Th>
                    <Th className="w-40">Type</Th>
                    <Th className="w-44">Role</Th>
                    <Th className="w-24">Normal</Th>
                    <Th numeric className="w-40">
                      Balance
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((account) => {
                    const meta = ACCOUNT_TYPE_META[account.type];
                    return (
                      <tr key={account.id} className="transition-colors hover:bg-surface-2">
                        <Td className="tnum font-medium text-ink-3">{account.code}</Td>
                        <Td>
                          <span className="font-medium text-ink">{account.name}</span>
                          {!account.active ? (
                            <Badge tone="draft" className="ml-2">
                              Archived
                            </Badge>
                          ) : null}
                        </Td>
                        <Td>
                          <Badge tone="neutral">{meta.label}</Badge>
                        </Td>
                        <Td className="text-ink-3">
                          {account.subtype === "NONE" ? (
                            <span className="text-ink-4">&mdash;</span>
                          ) : (
                            SUBTYPE_LABELS[account.subtype] ?? account.subtype
                          )}
                          {account.reconcilable ? (
                            <Badge tone="neutral" className="ml-2">
                              Reconcilable
                            </Badge>
                          ) : null}
                        </Td>
                        <Td className="text-[11.5px] tracking-wide text-ink-3 uppercase">
                          {meta.normal === "DEBIT" ? "Debit" : "Credit"}
                        </Td>
                        <Td numeric>
                          <Money paise={balanceByAccount.get(account.id) ?? 0n} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Panel>
          );
        })}
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
        Balances are as at {asOf.toISOString().slice(0, 10)} and are summed from posted journal
        items only. The <em>Role</em> column marks the accounts the posting engine reaches for by
        function rather than by name — a receivable, an input tax account, the current year
        earnings line.
      </p>
    </>
  );
}

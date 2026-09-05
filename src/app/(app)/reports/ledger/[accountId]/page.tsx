import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { accountLedger } from "@/lib/reports/ledger";
import { ACCOUNT_TYPE_META } from "@/lib/accounting/account-type";
import { formatDate, today } from "@/lib/app-context";
import { Money } from "@/components/ui/money";
import {
  Badge,
  EmptyState,
  Panel,
  PanelHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { PrintButton } from "@/components/report-frame";

export const dynamic = "force-dynamic";

export default async function AccountLedgerPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const asOf = today();

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) notFound();

  const rows = await accountLedger(prisma, accountId, { to: asOf });
  const meta = ACCOUNT_TYPE_META[account.type];
  const closing = rows.at(-1)?.runningPaise ?? 0n;
  const totalDebit = rows.reduce((s, r) => s + r.debitPaise, 0n);
  const totalCredit = rows.reduce((s, r) => s + r.creditPaise, 0n);

  return (
    <>
      <Link
        href="/reports/trial-balance"
        className="no-print mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Trial balance
      </Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps mb-1.5">General ledger</p>
          <h1 className="font-display text-[26px] leading-none text-ink">
            <span className="tnum text-ink-3">{account.code}</span> {account.name}
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <Badge tone="neutral">{meta.label}</Badge>
            <span className="text-[12px] text-ink-3">
              {meta.normal === "DEBIT" ? "Debit" : "Credit"} balance account &middot; every posted
              movement to {formatDate(asOf)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="label-caps">Closing balance</p>
            <p className="mt-1 font-display text-[22px] leading-none text-ink">
              <Money paise={closing} symbol dashZero={false} />
            </p>
          </div>
          <PrintButton />
        </div>
      </div>

      <Panel>
        <PanelHeader
          title="Movements"
          subtitle={`${rows.length} posted journal items, oldest first`}
        />
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing posted to this account"
            hint="It will fill up as soon as a document that resolves to it is confirmed."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-28">Date</Th>
                <Th className="w-36">Entry</Th>
                <Th>Label</Th>
                <Th>Partner</Th>
                <Th numeric className="w-32">
                  Debit
                </Th>
                <Th numeric className="w-32">
                  Credit
                </Th>
                <Th numeric className="w-36">
                  Balance
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-surface-2">
                  <Td className="whitespace-nowrap text-ink-3">{formatDate(row.date)}</Td>
                  <Td>
                    <Link
                      href={`/journal-entries/${row.entryId}`}
                      className="font-medium text-ink hover:text-walnut hover:underline"
                    >
                      {row.entryName}
                    </Link>
                  </Td>
                  <Td className="max-w-[16rem] truncate">{row.label ?? "\u2014"}</Td>
                  <Td className="text-ink-3">{row.partnerName ?? "\u2014"}</Td>
                  <Td numeric>
                    <Money paise={row.debitPaise} />
                  </Td>
                  <Td numeric>
                    <Money paise={row.creditPaise} />
                  </Td>
                  <Td numeric className="font-medium">
                    <Money paise={row.runningPaise} dashZero={false} />
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <Td colSpan={4} className="rule-total font-semibold text-ink">
                  Total
                </Td>
                <Td numeric className="rule-total">
                  <Money paise={totalDebit} emphasis dashZero={false} />
                </Td>
                <Td numeric className="rule-total">
                  <Money paise={totalCredit} emphasis dashZero={false} />
                </Td>
                <Td numeric className="rule-total">
                  <Money paise={closing} emphasis dashZero={false} />
                </Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Panel>
    </>
  );
}

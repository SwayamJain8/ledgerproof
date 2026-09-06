import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/app-context";
import { Money } from "@/components/ui/money";
import {
  Badge,
  ButtonLink,
  Detail,
  Panel,
  PanelHeader,
  StateBadge,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { getSession } from "@/lib/auth/session";
import { ExplainPanel, type TraceRow } from "./explain-panel";
import { ResetToDraftButton, ReverseButton } from "./reverse-button";

export const dynamic = "force-dynamic";

const SOURCE_LINKS: Record<string, (id: string) => string> = {
  CUSTOMER_INVOICE: (id) => `/invoices/${id}`,
  VENDOR_BILL: (id) => `/bills/${id}`,
  PAYMENT: (id) => `/payments/${id}`,
};

const SOURCE_LABELS: Record<string, string> = {
  CUSTOMER_INVOICE: "Customer invoice",
  VENDOR_BILL: "Vendor bill",
  PAYMENT: "Payment",
  MANUAL: "Manual entry",
  REVERSAL: "Reversal",
  OPENING_BALANCE: "Opening balance",
  STOCK_MOVE: "Stock move",
};

export default async function JournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      journal: true,
      partner: true,
      postedBy: { select: { name: true } },
      reversalOf: { select: { id: true, name: true } },
      reversedBy: { select: { id: true, name: true } },
      items: {
        orderBy: { lineNo: "asc" },
        include: {
          account: true,
          partner: { select: { name: true } },
          analyticAccount: { select: { name: true } },
        },
      },
    },
  });

  if (!entry) notFound();

  // Only the tail of the hash chain can be un-posted; anything older is
  // cancelled by reversal instead.
  const tail = await prisma.journalEntry.findFirst({
    where: { chainIndex: { not: null } },
    orderBy: { chainIndex: "desc" },
    select: { id: true },
  });
  const isNewestEntry = tail?.id === entry.id;

  const trace = (entry.postingTrace as unknown as TraceRow[] | null) ?? [];
  const sourceHref =
    entry.sourceId && SOURCE_LINKS[entry.sourceType]
      ? SOURCE_LINKS[entry.sourceType](entry.sourceId)
      : null;

  return (
    <>
      <Link
        href="/journal-entries"
        className="no-print mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Journal entries
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps mb-1.5">{SOURCE_LABELS[entry.sourceType] ?? entry.sourceType}</p>
          <h1 className="font-display text-[26px] leading-none text-ink">{entry.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StateBadge state={entry.state} />
            <Badge tone="neutral">{entry.journal.name}</Badge>
            {entry.reversalOf ? <Badge tone="unpaid">Reversal</Badge> : null}
            {entry.reversedBy ? <Badge tone="unpaid">Reversed</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          {sourceHref ? (
            <ButtonLink href={sourceHref}>Open source document</ButtonLink>
          ) : null}
          {/* Only a live entry can be cancelled: not one that is already a
              reversal, and not one that has already been reversed once. */}
          {entry.state === "POSTED" && !entry.reversalOf && !entry.reversedBy ? (
            <ReverseButton entryId={entry.id} />
          ) : null}
          {/* Administrator only, and only on the newest entry — an accountant
              never sees a button that would refuse them. */}
          {session?.role === "ADMIN" && entry.state === "POSTED" && isNewestEntry ? (
            <ResetToDraftButton entryId={entry.id} />
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Journal items"
              subtitle="Debits and credits, exactly as stored in the ledger"
            />
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">#</Th>
                  <Th>Account</Th>
                  <Th>Label</Th>
                  <Th>Partner</Th>
                  <Th>Analytic</Th>
                  <Th numeric className="w-36">
                    Debit
                  </Th>
                  <Th numeric className="w-36">
                    Credit
                  </Th>
                </tr>
              </thead>
              <tbody>
                {entry.items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-surface-2">
                    <Td className="tnum text-ink-4">{item.lineNo}</Td>
                    <Td>
                      <Link
                        href={`/reports/ledger/${item.accountId}`}
                        className="font-medium text-ink hover:text-walnut hover:underline"
                      >
                        <span className="tnum text-ink-3">{item.account.code}</span>{" "}
                        {item.account.name}
                      </Link>
                    </Td>
                    <Td className="max-w-[14rem] truncate">{item.label ?? "\u2014"}</Td>
                    <Td className="text-ink-3">{item.partner?.name ?? "\u2014"}</Td>
                    <Td className="text-ink-3">{item.analyticAccount?.name ?? "\u2014"}</Td>
                    <Td numeric>
                      <Money paise={item.debitPaise} />
                    </Td>
                    <Td numeric>
                      <Money paise={item.creditPaise} />
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <Td colSpan={5} className="rule-total font-medium text-ink">
                    Total
                  </Td>
                  <Td numeric className="rule-total">
                    <Money paise={entry.totalDebitPaise} emphasis dashZero={false} />
                  </Td>
                  <Td numeric className="rule-total">
                    <Money paise={entry.totalCreditPaise} emphasis dashZero={false} />
                  </Td>
                </tr>
              </tfoot>
            </Table>

            <p className="border-t border-rule px-4 py-2.5 text-[11.5px] text-ink-3">
              {entry.totalDebitPaise === entry.totalCreditPaise
                ? "Debits equal credits. A deferred database trigger asserted this at commit — an unbalanced entry cannot exist in this table."
                : "This entry does not balance."}
            </p>
          </Panel>

          <div className="no-print">
            <ExplainPanel trace={trace} />
          </div>
        </div>

        <aside className="space-y-4">
          <Panel>
            <PanelHeader title="Details" />
            <dl className="grid grid-cols-2 gap-4 px-4 py-4">
              <Detail label="Accounting date">{formatDate(entry.date)}</Detail>
              <Detail label="Journal">{entry.journal.code}</Detail>
              <Detail label="Partner">{entry.partner?.name ?? "\u2014"}</Detail>
              <Detail label="Reference">{entry.ref ?? "\u2014"}</Detail>
              <Detail label="Posted by">{entry.postedBy?.name ?? "System"}</Detail>
              <Detail label="Posted at">
                {entry.postedAt ? formatDate(entry.postedAt) : "\u2014"}
              </Detail>
            </dl>
          </Panel>

          {entry.reversalOf || entry.reversedBy ? (
            <Panel>
              <PanelHeader title="Reversal chain" />
              <div className="space-y-2 px-4 py-4 text-[13px]">
                {entry.reversalOf ? (
                  <p className="text-ink-2">
                    Reverses{" "}
                    <Link
                      href={`/journal-entries/${entry.reversalOf.id}`}
                      className="font-medium text-walnut hover:underline"
                    >
                      {entry.reversalOf.name}
                    </Link>
                  </p>
                ) : null}
                {entry.reversedBy ? (
                  <p className="text-ink-2">
                    Reversed by{" "}
                    <Link
                      href={`/journal-entries/${entry.reversedBy.id}`}
                      className="font-medium text-walnut hover:underline"
                    >
                      {entry.reversedBy.name}
                    </Link>
                  </p>
                ) : null}
                <p className="border-t border-rule pt-2 text-[11.5px] text-ink-3">
                  Both rows stay in the books permanently. Cancelling a posted entry never deletes
                  it.
                </p>
              </div>
            </Panel>
          ) : null}
        </aside>
      </div>
    </>
  );
}

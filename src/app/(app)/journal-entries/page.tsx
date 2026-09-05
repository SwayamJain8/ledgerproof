import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/app-context";
import { Money } from "@/components/ui/money";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  StateBadge,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Journal Entries" };

const SOURCE_LABELS: Record<string, string> = {
  CUSTOMER_INVOICE: "Invoice",
  VENDOR_BILL: "Bill",
  PAYMENT: "Payment",
  MANUAL: "Manual",
  REVERSAL: "Reversal",
  OPENING_BALANCE: "Opening",
  STOCK_MOVE: "Stock",
};

export default async function JournalEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ journal?: string; source?: string }>;
}) {
  const filters = await searchParams;

  const [entries, journals] = await Promise.all([
    prisma.journalEntry.findMany({
      where: {
        ...(filters.journal ? { journal: { code: filters.journal } } : {}),
        ...(filters.source ? { sourceType: filters.source as never } : {}),
      },
      orderBy: [{ date: "desc" }, { name: "desc" }],
      take: 200,
      include: {
        journal: { select: { code: true, name: true } },
        partner: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.journal.findMany({ orderBy: { code: "asc" } }),
  ]);

  const totalDebit = entries.reduce((sum, e) => sum + e.totalDebitPaise, 0n);

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Journal Entries"
        description="The ledger itself. Every confirmed invoice, bill and payment appears here as a balanced entry — there is no other way for a number to enter the books."
      />

      {/* Journal filter, as tabs rather than a dropdown: there are only five. */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-1.5">
        <FilterChip href="/journal-entries" active={!filters.journal}>
          All journals
        </FilterChip>
        {journals.map((journal) => (
          <FilterChip
            key={journal.id}
            href={`/journal-entries?journal=${journal.code}`}
            active={filters.journal === journal.code}
          >
            {journal.name}
          </FilterChip>
        ))}
      </div>

      <Panel>
        {entries.length === 0 ? (
          <EmptyState
            title="No journal entries"
            hint="Confirm a bill or an invoice and its entry will appear here."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-28">Date</Th>
                <Th className="w-40">Number</Th>
                <Th className="w-24">Journal</Th>
                <Th className="w-28">Source</Th>
                <Th>Partner / reference</Th>
                <Th numeric className="w-16">
                  Lines
                </Th>
                <Th numeric className="w-36">
                  Debit
                </Th>
                <Th numeric className="w-36">
                  Credit
                </Th>
                <Th className="w-24">State</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="transition-colors hover:bg-surface-2">
                  <Td className="whitespace-nowrap text-ink-3">{formatDate(entry.date)}</Td>
                  <Td>
                    <Link
                      href={`/journal-entries/${entry.id}`}
                      className="font-medium text-ink hover:text-walnut hover:underline"
                    >
                      {entry.name}
                    </Link>
                  </Td>
                  <Td className="text-ink-3">{entry.journal.code}</Td>
                  <Td>
                    <Badge tone="neutral">
                      {SOURCE_LABELS[entry.sourceType] ?? entry.sourceType}
                    </Badge>
                  </Td>
                  <Td className="max-w-[18rem] truncate">
                    {entry.partner?.name ?? <span className="text-ink-4">&mdash;</span>}
                    {entry.ref ? <span className="ml-2 text-ink-4">{entry.ref}</span> : null}
                  </Td>
                  <Td numeric className="tnum text-ink-3">
                    {entry._count.items}
                  </Td>
                  <Td numeric>
                    <Money paise={entry.totalDebitPaise} />
                  </Td>
                  <Td numeric>
                    <Money paise={entry.totalCreditPaise} />
                  </Td>
                  <Td>
                    <StateBadge state={entry.state} />
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <Td colSpan={6} className="rule-total font-medium text-ink">
                  {entries.length} entries shown
                </Td>
                <Td numeric className="rule-total">
                  <Money paise={totalDebit} emphasis dashZero={false} />
                </Td>
                <Td numeric className="rule-total">
                  <Money paise={totalDebit} emphasis dashZero={false} />
                </Td>
                <Td className="rule-total" />
              </tr>
            </tfoot>
          </Table>
        )}
      </Panel>
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-2.5 py-1 text-[12.5px] transition-colors ${
        active
          ? "border-walnut bg-walnut text-surface"
          : "border-rule-2 bg-surface text-ink-2 hover:border-rule-3 hover:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}

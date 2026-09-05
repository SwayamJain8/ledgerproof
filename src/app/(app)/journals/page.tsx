import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { Badge, PageHeader, Panel, Table, Td, Th } from "@/components/ui/primitives";
import { JournalDefaultForm } from "./journal-default-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Journals" };

const TYPE_ROLES: Record<string, string> = {
  SALES: "Net of every customer invoice line lands here (chain R1, rung 4)",
  PURCHASE: "Net of every vendor bill line lands here (chain R2, rung 4)",
  BANK: "Money in and out by transfer (chain R5)",
  CASH: "Money in and out over the counter (chain R5)",
};

export default async function JournalsPage() {
  const [journals, accounts] = await Promise.all([
    prisma.journal.findMany({
      orderBy: { code: "asc" },
      include: {
        defaultAccount: true,
        _count: { select: { entries: true } },
      },
    }),
    prisma.account.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Journals"
        description="A journal groups entries by the kind of transaction that produced them, and supplies the fallback account when nothing more specific is configured."
      />

      {/* The instruction that turns this screen into a demonstration. */}
      <div className="mb-4 rounded-md border border-brass/25 bg-brass-2/60 px-4 py-3">
        <p className="label-caps mb-1 text-amber">Try this</p>
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-2">
          Change the Purchase journal&apos;s default account below, then confirm a new vendor bill.
          The debit lands on the account you just chose. No code was edited, and no bill posted
          before the change moves — posted entries are immutable, so the ledger shows exactly when
          the policy changed.
        </p>
      </div>

      <Panel>
        <Table>
          <thead>
            <tr>
              <Th className="w-20">Code</Th>
              <Th className="w-44">Journal</Th>
              <Th>What its default account does</Th>
              <Th className="w-[22rem]">Default account</Th>
              <Th numeric className="w-24">
                Entries
              </Th>
            </tr>
          </thead>
          <tbody>
            {journals.map((journal) => (
              <tr key={journal.id}>
                <Td className="tnum font-medium text-ink-3">{journal.code}</Td>
                <Td>
                  <span className="font-medium text-ink">{journal.name}</span>
                  <Badge tone="neutral" className="ml-2">
                    {journal.type}
                  </Badge>
                </Td>
                <Td className="text-[12.5px] text-ink-3">{TYPE_ROLES[journal.type]}</Td>
                <Td>
                  <JournalDefaultForm
                    journalId={journal.id}
                    current={journal.defaultAccountId}
                    accounts={accounts}
                  />
                </Td>
                <Td numeric className="tnum text-ink-3">
                  {journal._count.entries}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-ink-3">
        The default account is the <strong>last</strong> rung of the resolution chain. Before
        reaching it the engine tries the line&apos;s own account override, then the product&apos;s
        income or expense account, then the product category&apos;s. Every entry records which
        rung actually fired — open any journal entry and use &ldquo;Explain this entry&rdquo; to
        see it.
      </p>
    </>
  );
}

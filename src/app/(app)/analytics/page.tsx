import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { Money } from "@/components/ui/money";
import { Badge, PageHeader, Panel, Table, Td, Th } from "@/components/ui/primitives";
import { KanbanCard, KanbanGrid, ViewRoot, ViewSwitch } from "@/components/ui/view-switch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytic Accounts" };

export default async function AnalyticsPage() {
  const analytics = await prisma.analyticAccount.findMany({
    orderBy: { name: "asc" },
    include: {
      journalItems: { where: { state: "POSTED" }, select: { debitPaise: true, creditPaise: true } },
      _count: { select: { budgetLines: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Master data"
        title="Analytic Accounts"
        description="A second dimension on top of the chart of accounts — projects, departments, campaigns. The tag is carried down onto every journal item, which is what lets budget actuals be summed from the ledger rather than from invoices."
        actions={<ViewSwitch storageKey="analytics" />}
      />

      <ViewRoot
        storageKey="analytics"
        list={
      <Panel>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th className="w-32">Type</Th>
              <Th numeric className="w-32">
                Tagged items
              </Th>
              <Th numeric className="w-28">
                Budget lines
              </Th>
              <Th numeric className="w-40">
                Net tagged amount
              </Th>
            </tr>
          </thead>
          <tbody>
            {analytics.map((analytic) => {
              const net = analytic.journalItems.reduce(
                (sum, item) => sum + item.debitPaise - item.creditPaise,
                0n,
              );
              return (
                <tr key={analytic.id} className="transition-colors hover:bg-surface-2">
                  <Td className="font-medium text-ink">{analytic.name}</Td>
                  <Td>
                    <Badge tone={analytic.type === "INCOME" ? "paid" : "partial"}>
                      {analytic.type}
                    </Badge>
                  </Td>
                  <Td numeric className="tnum text-ink-3">
                    {analytic.journalItems.length}
                  </Td>
                  <Td numeric className="tnum text-ink-3">
                    {analytic._count.budgetLines}
                  </Td>
                  <Td numeric className="font-medium">
                    <Money paise={net < 0n ? -net : net} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Panel>
        }
        kanban={
          <Panel>
            <KanbanGrid>
              {analytics.map((analytic) => {
                const net = analytic.journalItems.reduce(
                  (sum, item) => sum + item.debitPaise - item.creditPaise,
                  0n,
                );
                return (
                  <KanbanCard
                    key={analytic.id}
                    title={analytic.name}
                    badge={
                      <Badge tone={analytic.type === "INCOME" ? "paid" : "partial"}>
                        {analytic.type}
                      </Badge>
                    }
                    rows={[
                      { label: "Tagged items", value: analytic.journalItems.length },
                      { label: "Budget lines", value: analytic._count.budgetLines },
                      { label: "Net tagged", value: <Money paise={net < 0n ? -net : net} /> },
                    ]}
                  />
                );
              })}
            </KanbanGrid>
          </Panel>
        }
      />
    </>
  );
}

import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { budgetActuals } from "@/lib/reports/budget";
import { formatDate } from "@/lib/app-context";
import { Money, Percent } from "@/components/ui/money";
import {
  ButtonLink,
  EmptyState,
  PageHeader,
  Panel,
  StateBadge,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Budgets" };

export default async function BudgetsPage() {
  const budgets = await prisma.budget.findMany({
    orderBy: { startDate: "desc" },
    include: {
      responsible: { select: { name: true } },
      revisionOf: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
    },
  });

  const actuals = new Map(
    await Promise.all(
      budgets.map(async (b) => [b.id, await budgetActuals(prisma, b.id)] as const),
    ),
  );

  return (
    <>
      <PageHeader
        eyebrow="Master data"
        title="Budgets"
        description="Planned spend per analytic account over a period. Achieved is never stored — it is summed live from posted journal items carrying the tag."
        actions={
          <ButtonLink href="/reports/budget" variant="primary">
            Budget vs Actual
          </ButtonLink>
        }
      />

      <Panel>
        {budgets.length === 0 ? (
          <EmptyState title="No budgets" hint="Budgets track spend per analytic account." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Budget</Th>
                <Th className="w-28">State</Th>
                <Th className="w-52">Period</Th>
                <Th>Responsible</Th>
                <Th numeric className="w-20">
                  Lines
                </Th>
                <Th numeric className="w-36">
                  Committed
                </Th>
                <Th numeric className="w-36">
                  Achieved
                </Th>
                <Th numeric className="w-24">
                  %
                </Th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => {
                const actual = actuals.get(budget.id);
                const pct =
                  actual && actual.totalCommittedPaise > 0n
                    ? (Number(actual.totalAchievedPaise) / Number(actual.totalCommittedPaise)) * 100
                    : 0;
                return (
                  <tr key={budget.id} className="transition-colors hover:bg-surface-2">
                    <Td className="font-medium text-ink">
                      {budget.name}
                      {budget.revisionOf ? (
                        <span className="ml-2 text-[11.5px] text-ink-3">
                          revises {budget.revisionOf.name}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <StateBadge state={budget.state} />
                    </Td>
                    <Td className="whitespace-nowrap text-ink-3">
                      {formatDate(budget.startDate)} &ndash; {formatDate(budget.endDate)}
                    </Td>
                    <Td className="text-ink-3">{budget.responsible?.name ?? "\u2014"}</Td>
                    <Td numeric className="tnum text-ink-3">
                      {budget._count.lines}
                    </Td>
                    <Td numeric>
                      <Money paise={actual?.totalCommittedPaise ?? 0n} />
                    </Td>
                    <Td numeric className="font-medium">
                      <Money paise={actual?.totalAchievedPaise ?? 0n} />
                    </Td>
                    <Td numeric className={pct > 100 ? "text-oxide" : ""}>
                      <Percent value={pct} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}

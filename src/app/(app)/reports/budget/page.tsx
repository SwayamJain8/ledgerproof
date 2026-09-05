import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { budgetActuals, achievedDrilldown } from "@/lib/reports/budget";
import { formatDate } from "@/lib/app-context";
import { Money, Percent } from "@/components/ui/money";
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
import { BudgetPie } from "@/components/ui/pie";
import { PrintButton } from "@/components/report-frame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Budget vs Actual" };

export default async function BudgetReportPage() {
  const budgets = await prisma.budget.findMany({
    where: { active: true },
    orderBy: { startDate: "desc" },
    include: { responsible: { select: { name: true } } },
  });

  const reports = await Promise.all(
    budgets.map(async (budget) => ({
      budget,
      actuals: await budgetActuals(prisma, budget.id),
      drilldowns: await Promise.all(
        (
          await prisma.budgetLine.findMany({
            where: { budgetId: budget.id },
            include: { analyticAccount: true },
          })
        ).map(async (line) => ({
          lineId: line.id,
          items: await achievedDrilldown(prisma, {
            analyticAccountId: line.analyticAccountId,
            type: line.type,
            from: budget.startDate,
            to: budget.endDate,
          }),
        })),
      ),
    })),
  );

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Budget vs Actual"
        description="Achieved is summed from posted journal items carrying the analytic tag — not from the bills that created them. A manual entry or a reversal moves this number too."
        actions={<PrintButton />}
      />

      {reports.length === 0 ? (
        <Panel>
          <EmptyState title="No budgets yet" hint="Create a budget to track spend against plan." />
        </Panel>
      ) : null}

      <div className="space-y-4">
        {reports.map(({ budget, actuals, drilldowns }) => (
          <Panel key={budget.id}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-[16px] text-ink">{budget.name}</h2>
                  <StateBadge state={budget.state} />
                </div>
                <p className="mt-1 text-[12px] text-ink-3">
                  {formatDate(budget.startDate)} &ndash; {formatDate(budget.endDate)}
                  {budget.responsible ? ` · ${budget.responsible.name}` : ""}
                </p>
              </div>
              <div className="flex gap-8 text-right">
                <div>
                  <p className="label-caps">Committed</p>
                  <p className="mt-1 text-[15px] font-medium">
                    <Money paise={actuals.totalCommittedPaise} dashZero={false} />
                  </p>
                </div>
                <div>
                  <p className="label-caps">Achieved</p>
                  <p className="mt-1 text-[15px] font-medium">
                    <Money paise={actuals.totalAchievedPaise} dashZero={false} />
                  </p>
                </div>
              </div>
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>Analytic account</Th>
                  <Th className="w-24">Type</Th>
                  <Th numeric className="w-40">
                    Committed
                  </Th>
                  <Th numeric className="w-40">
                    Achieved
                  </Th>
                  <Th className="w-52">Progress</Th>
                  <Th numeric className="w-40">
                    To achieve
                  </Th>
                </tr>
              </thead>
              <tbody>
                {actuals.lines.map((line) => {
                  const over = line.achievedPercent > 100;
                  return (
                    <tr key={line.budgetLineId}>
                      <Td className="font-medium text-ink">{line.analyticName}</Td>
                      <Td>
                        <Badge tone="neutral">{line.type}</Badge>
                      </Td>
                      <Td numeric>
                        <Money paise={line.committedPaise} />
                      </Td>
                      <Td numeric>
                        <Money paise={line.achievedPaise} />
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <BudgetPie
                            percent={line.achievedPercent}
                            className={over ? "text-oxide" : "text-walnut"}
                            title={`${line.analyticName}: ${Math.round(line.achievedPercent)}% achieved`}
                          />
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                            <div
                              className={`h-full rounded-full ${over ? "bg-oxide" : "bg-walnut"}`}
                              style={{ width: `${Math.min(line.achievedPercent, 100)}%` }}
                            />
                          </div>
                          <span className="tnum w-12 text-right text-[12px] text-ink-3">
                            <Percent value={line.achievedPercent} />
                          </span>
                        </div>
                      </Td>
                      <Td numeric className={over ? "text-oxide" : ""}>
                        <Money paise={line.amountToAchievePaise} dashZero={false} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            {/* Where the Achieved figure came from, item by item. */}
            {drilldowns.map((drill) =>
              drill.items.length === 0 ? null : (
                <details key={drill.lineId} className="no-print border-t border-rule">
                  <summary className="cursor-pointer px-4 py-2.5 text-[12.5px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-walnut">
                    Show the {drill.items.length} journal items behind this figure
                  </summary>
                  <div className="bg-surface-2/60">
                    <Table>
                      <thead>
                        <tr>
                          <Th className="w-28">Date</Th>
                          <Th className="w-36">Entry</Th>
                          <Th>Label</Th>
                          <Th>Account</Th>
                          <Th numeric className="w-36">
                            Amount
                          </Th>
                        </tr>
                      </thead>
                      <tbody>
                        {drill.items.map((item) => (
                          <tr key={item.id}>
                            <Td className="whitespace-nowrap text-ink-3">
                              {formatDate(item.date)}
                            </Td>
                            <Td>
                              <Link
                                href={`/journal-entries/${item.entryId}`}
                                className="font-medium text-ink hover:text-walnut hover:underline"
                              >
                                {item.entry?.name ?? "\u2014"}
                              </Link>
                            </Td>
                            <Td className="max-w-[16rem] truncate">{item.label ?? "\u2014"}</Td>
                            <Td className="text-ink-3">
                              {item.account?.code} {item.account?.name}
                            </Td>
                            <Td numeric>
                              <Money paise={item.debitPaise - item.creditPaise} />
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </details>
              ),
            )}
          </Panel>
        ))}
      </div>
    </>
  );
}

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { prisma } from "@/lib/db";
import { accountBalances } from "@/lib/reports/ledger";
import { profitAndLoss } from "@/lib/reports/profit-loss";
import { budgetActuals } from "@/lib/reports/budget";
import { currentFiscalYear, formatDate, formatDateShort, today } from "@/lib/app-context";
import { Money, Percent } from "@/components/ui/money";
import {
  Badge,
  ButtonLink,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  PaymentBadge,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  CUSTOMER_INVOICE: "Invoice",
  VENDOR_BILL: "Bill",
  PAYMENT: "Payment",
  MANUAL: "Manual",
  REVERSAL: "Reversal",
  OPENING_BALANCE: "Opening",
  STOCK_MOVE: "Stock",
};

/** A figure with its label, ruled rather than boxed in a shadowed card. */
function Figure({
  label,
  paise,
  caption,
  href,
  tone,
}: {
  label: string;
  paise: bigint;
  caption: string;
  href: string;
  tone?: "ledger" | "oxide";
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between rounded-md border border-rule bg-surface p-4 transition-colors hover:border-rule-3 hover:bg-surface-2"
    >
      <div className="flex items-start justify-between">
        <p className="label-caps">{label}</p>
        <ArrowUpRight className="h-3.5 w-3.5 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p
        className={`mt-4 font-display text-[26px] leading-none ${
          tone === "ledger" ? "text-ledger" : tone === "oxide" ? "text-oxide" : "text-ink"
        }`}
      >
        <Money paise={paise} symbol dashZero={false} />
      </p>
      <p className="mt-1.5 text-[11.5px] text-ink-3">{caption}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const asOf = today();
  const fy = currentFiscalYear();

  const [balances, pl, recentEntries, openInvoices, openBills, budgets] = await Promise.all([
    accountBalances(prisma, { to: asOf }),
    profitAndLoss(prisma, { from: fy.start, to: asOf }),
    prisma.journalEntry.findMany({
      where: { state: "POSTED" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: { journal: { select: { code: true } }, partner: { select: { name: true } } },
    }),
    prisma.customerInvoice.findMany({
      where: { state: "POSTED", residualPaise: { gt: 0 } },
      orderBy: { dueDate: "asc" },
      take: 6,
      include: { customer: { select: { name: true } } },
    }),
    prisma.vendorBill.findMany({
      where: { state: "POSTED", residualPaise: { gt: 0 } },
      orderBy: { dueDate: "asc" },
      take: 6,
      include: { vendor: { select: { name: true } } },
    }),
    prisma.budget.findMany({ where: { state: "CONFIRMED", active: true }, take: 2 }),
  ]);

  const sumOf = (predicate: (type: string, subtype: string) => boolean) =>
    balances.filter((b) => predicate(b.type, b.subtype)).reduce((s, b) => s + b.balancePaise, 0n);

  const liquid = sumOf((type) => type === "BANK" || type === "CASH");
  const receivable = sumOf((_, subtype) => subtype === "RECEIVABLE");
  const payable = sumOf((_, subtype) => subtype === "PAYABLE");

  const budgetLines = await Promise.all(budgets.map((b) => budgetActuals(prisma, b.id)));

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description={`Everything below is derived from posted journal items as at ${formatDate(asOf)}.`}
        actions={
          <>
            <ButtonLink href="/invoices/new">New Invoice</ButtonLink>
            <ButtonLink href="/bills/new" variant="primary">
              New Bill
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label="Bank & Cash"
          paise={liquid}
          caption="Across all money journals"
          href="/reports/balance-sheet"
        />
        <Figure
          label="Owed to us"
          paise={receivable}
          caption="Debtors control account"
          href="/reports/partner-ledger"
          tone="ledger"
        />
        <Figure
          label="We owe"
          paise={payable}
          caption="Creditors control account"
          href="/reports/partner-ledger"
          tone="oxide"
        />
        <Figure
          label={`Net income · ${fy.label}`}
          paise={pl.netIncomePaise}
          caption="Income less all expenses"
          href="/reports/profit-loss"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* ── Recent ledger activity ── */}
        <Panel>
          <PanelHeader
            title="Latest journal entries"
            subtitle="Every posted document lands here"
            actions={
              <ButtonLink href="/journal-entries" size="sm" variant="ghost">
                View all
              </ButtonLink>
            }
          />
          {recentEntries.length === 0 ? (
            <EmptyState
              title="No entries posted yet"
              hint="Confirm an invoice or a bill and its journal entry will appear here."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Number</Th>
                  <Th>Source</Th>
                  <Th>Partner</Th>
                  <Th numeric>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-surface-2">
                    <Td className="whitespace-nowrap text-ink-3">{formatDateShort(entry.date)}</Td>
                    <Td>
                      <Link
                        href={`/journal-entries/${entry.id}`}
                        className="font-medium text-ink hover:text-walnut hover:underline"
                      >
                        {entry.name}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{SOURCE_LABELS[entry.sourceType] ?? entry.sourceType}</Badge>
                    </Td>
                    <Td className="max-w-[12rem] truncate">{entry.partner?.name ?? "\u2014"}</Td>
                    <Td numeric>
                      <Money paise={entry.totalDebitPaise} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <div className="space-y-4">
          {/* ── P&L at a glance ── */}
          <Panel>
            <PanelHeader title="Profit & Loss" subtitle={`${fy.label} to date`} />
            <dl className="px-4 py-3 text-[13px]">
              <div className="flex items-center justify-between py-1.5">
                <dt className="text-ink-2">Income</dt>
                <dd>
                  <Money paise={pl.income.amountPaise} />
                </dd>
              </div>
              {pl.expenseRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5">
                  <dt className="text-ink-2">{row.label}</dt>
                  <dd className="text-oxide">
                    (<Money paise={row.amountPaise} className="text-oxide" />)
                  </dd>
                </div>
              ))}
              <div className="rule-total mt-2 flex items-center justify-between pt-2">
                <dt className="font-medium text-ink">Net income</dt>
                <dd>
                  <Money paise={pl.netIncomePaise} emphasis dashZero={false} />
                </dd>
              </div>
            </dl>
          </Panel>

          {/* ── Budgets ── */}
          {budgetLines.length > 0 ? (
            <Panel>
              <PanelHeader
                title="Budgets"
                subtitle="Achieved from tagged journal items"
                actions={
                  <ButtonLink href="/reports/budget" size="sm" variant="ghost">
                    Detail
                  </ButtonLink>
                }
              />
              <div className="space-y-4 px-4 py-4">
                {budgetLines.flatMap((budget) =>
                  budget.lines.map((line) => {
                    const pct = Math.min(line.achievedPercent, 100);
                    const over = line.achievedPercent > 100;
                    return (
                      <div key={line.budgetLineId}>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {line.analyticName}
                          </p>
                          <p className="text-[12px] text-ink-3">
                            <Money paise={line.achievedPaise} /> of{" "}
                            <Money paise={line.committedPaise} />
                          </p>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className={`h-full rounded-full ${over ? "bg-oxide" : "bg-walnut"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11.5px] text-ink-3">
                          <Percent value={line.achievedPercent} /> achieved &middot;{" "}
                          <Money paise={line.amountToAchievePaise} /> remaining
                        </p>
                      </div>
                    );
                  }),
                )}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      {/* ── What needs chasing and what needs paying ── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Unpaid customer invoices"
            subtitle="Oldest due first"
            actions={
              <ButtonLink href="/invoices" size="sm" variant="ghost">
                All invoices
              </ButtonLink>
            }
          />
          {openInvoices.length === 0 ? (
            <EmptyState title="Nothing outstanding" hint="Every posted invoice has been settled." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Customer</Th>
                  <Th>Due</Th>
                  <Th numeric>Amount due</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {openInvoices.map((invoice) => {
                  const overdue = invoice.dueDate < asOf;
                  return (
                    <tr key={invoice.id} className="transition-colors hover:bg-surface-2">
                      <Td>
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="font-medium text-ink hover:text-walnut hover:underline"
                        >
                          {invoice.name}
                        </Link>
                      </Td>
                      <Td className="max-w-[10rem] truncate">{invoice.customer.name}</Td>
                      <Td className={overdue ? "whitespace-nowrap text-oxide" : "whitespace-nowrap text-ink-3"}>
                        {formatDateShort(invoice.dueDate)}
                      </Td>
                      <Td numeric>
                        <Money paise={invoice.residualPaise} />
                      </Td>
                      <Td>
                        <PaymentBadge state={invoice.paymentState} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Unpaid vendor bills"
            subtitle="Oldest due first"
            actions={
              <ButtonLink href="/bills" size="sm" variant="ghost">
                All bills
              </ButtonLink>
            }
          />
          {openBills.length === 0 ? (
            <EmptyState title="Nothing outstanding" hint="Every posted bill has been settled." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Bill</Th>
                  <Th>Vendor</Th>
                  <Th>Due</Th>
                  <Th numeric>Amount due</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {openBills.map((bill) => {
                  const overdue = bill.dueDate < asOf;
                  return (
                    <tr key={bill.id} className="transition-colors hover:bg-surface-2">
                      <Td>
                        <Link
                          href={`/bills/${bill.id}`}
                          className="font-medium text-ink hover:text-walnut hover:underline"
                        >
                          {bill.name}
                        </Link>
                      </Td>
                      <Td className="max-w-[10rem] truncate">{bill.vendor.name}</Td>
                      <Td className={overdue ? "whitespace-nowrap text-oxide" : "whitespace-nowrap text-ink-3"}>
                        {formatDateShort(bill.dueDate)}
                      </Td>
                      <Td numeric>
                        <Money paise={bill.residualPaise} />
                      </Td>
                      <Td>
                        <PaymentBadge state={bill.paymentState} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}

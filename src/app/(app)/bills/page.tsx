import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { formatDate, today } from "@/lib/app-context";
import { Money } from "@/components/ui/money";
import {
  ButtonLink,
  EmptyState,
  PageHeader,
  Panel,
  PaymentBadge,
  StateBadge,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vendor Bills" };

export default async function BillsPage() {
  const asOf = today();
  const bills = await prisma.vendorBill.findMany({
    orderBy: [{ billDate: "desc" }, { createdAt: "desc" }],
    include: { vendor: { select: { name: true } } },
  });

  const outstanding = bills.reduce((s, b) => s + b.residualPaise, 0n);

  return (
    <>
      <PageHeader
        eyebrow="Purchase"
        title="Vendor Bills"
        description="What suppliers have invoiced us. Confirming a bill posts Dr Purchase Expense, Dr Input GST, Cr Creditors — with every account resolved from configuration."
        actions={
          <ButtonLink href="/bills/new" variant="primary">
            New bill
          </ButtonLink>
        }
      />

      <Panel>
        {bills.length === 0 ? (
          <EmptyState
            title="No vendor bills yet"
            hint="Record what a supplier has invoiced you, then confirm it to post the entry."
            action={<ButtonLink href="/bills/new" variant="primary">New bill</ButtonLink>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-40">Number</Th>
                <Th>Vendor</Th>
                <Th className="w-32">Reference</Th>
                <Th className="w-28">Bill date</Th>
                <Th className="w-28">Due</Th>
                <Th numeric className="w-36">
                  Total
                </Th>
                <Th numeric className="w-36">
                  Amount due
                </Th>
                <Th className="w-24">State</Th>
                <Th className="w-24">Payment</Th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => {
                const overdue = bill.residualPaise > 0n && bill.dueDate < asOf;
                const draft = bill.state === "DRAFT";
                return (
                  <tr key={bill.id} className="transition-colors hover:bg-surface-2">
                    <Td>
                      <Link
                        href={`/bills/${bill.id}`}
                        className="font-medium text-ink hover:text-walnut hover:underline"
                      >
                        {draft ? <span className="text-ink-3">Draft</span> : bill.name}
                      </Link>
                    </Td>
                    <Td className="max-w-[14rem] truncate">{bill.vendor.name}</Td>
                    <Td className="text-ink-3">{bill.billReference ?? "\u2014"}</Td>
                    <Td className="whitespace-nowrap text-ink-3">{formatDate(bill.billDate)}</Td>
                    <Td
                      className={
                        overdue ? "whitespace-nowrap font-medium text-oxide" : "whitespace-nowrap text-ink-3"
                      }
                    >
                      {formatDate(bill.dueDate)}
                    </Td>
                    <Td numeric>
                      <Money paise={bill.totalPaise} />
                    </Td>
                    <Td numeric className="font-medium">
                      <Money paise={bill.residualPaise} />
                    </Td>
                    <Td>
                      <StateBadge state={bill.state} />
                    </Td>
                    <Td>{draft ? null : <PaymentBadge state={bill.paymentState} />}</Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <Td colSpan={6} className="rule-total font-medium text-ink">
                  {bills.length} bills
                </Td>
                <Td numeric className="rule-total">
                  <Money paise={outstanding} emphasis dashZero={false} />
                </Td>
                <Td colSpan={2} className="rule-total" />
              </tr>
            </tfoot>
          </Table>
        )}
      </Panel>
    </>
  );
}

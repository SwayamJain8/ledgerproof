import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/app-context";
import { Money } from "@/components/ui/money";
import {
  EmptyState,
  PageHeader,
  Panel,
  StateBadge,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sales Orders" };

export default async function SalesOrdersPage() {
  const orders = await prisma.salesOrder.findMany({
    orderBy: [{ orderDate: "desc" }],
    include: {
      customer: { select: { name: true } },
      lines: { select: { quantityMilli: true, qtyInvoicedMilli: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Sales Orders"
        description="A sales order records what a customer has agreed to buy. Nothing reaches the ledger until the invoice is confirmed — an order is a promise, not revenue."
      />

      <Panel>
        {orders.length === 0 ? (
          <EmptyState
            title="No sales orders"
            hint="Orders record intent. Invoices record what the ledger believes."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-40">Number</Th>
                <Th>Customer</Th>
                <Th className="w-28">Order date</Th>
                <Th numeric className="w-36">
                  Total
                </Th>
                <Th className="w-40">Invoiced</Th>
                <Th className="w-32">State</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const ordered = order.lines.reduce((s, l) => s + l.quantityMilli, 0n);
                const invoiced = order.lines.reduce((s, l) => s + l.qtyInvoicedMilli, 0n);
                const pct = ordered === 0n ? 0 : Number((invoiced * 100n) / ordered);
                return (
                  <tr key={order.id} className="transition-colors hover:bg-surface-2">
                    <Td className="font-medium text-ink">{order.name}</Td>
                    <Td>{order.customer.name}</Td>
                    <Td className="whitespace-nowrap text-ink-3">{formatDate(order.orderDate)}</Td>
                    <Td numeric>
                      <Money paise={order.totalPaise} />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full rounded-full bg-walnut" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="tnum w-10 text-right text-[12px] text-ink-3">{pct}%</span>
                      </div>
                    </Td>
                    <Td>
                      <StateBadge state={order.state} />
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

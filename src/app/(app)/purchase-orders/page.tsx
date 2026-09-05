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
export const metadata: Metadata = { title: "Purchase Orders" };

export default async function PurchaseOrdersPage() {
  const orders = await prisma.purchaseOrder.findMany({
    orderBy: [{ orderDate: "desc" }],
    include: {
      vendor: { select: { name: true } },
      lines: { select: { quantityMilli: true, qtyBilledMilli: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Purchase"
        title="Purchase Orders"
        description="A purchase order is a commitment, not a transaction — it posts nothing. The ledger only moves when the resulting vendor bill is confirmed."
      />

      <Panel>
        {orders.length === 0 ? (
          <EmptyState
            title="No purchase orders"
            hint="Orders record intent. Bills record what the ledger believes."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-40">Number</Th>
                <Th>Vendor</Th>
                <Th className="w-28">Order date</Th>
                <Th numeric className="w-36">
                  Total
                </Th>
                <Th className="w-40">Billed</Th>
                <Th className="w-32">State</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const ordered = order.lines.reduce((s, l) => s + l.quantityMilli, 0n);
                const billed = order.lines.reduce((s, l) => s + l.qtyBilledMilli, 0n);
                const pct = ordered === 0n ? 0 : Number((billed * 100n) / ordered);
                return (
                  <tr key={order.id} className="transition-colors hover:bg-surface-2">
                    <Td className="font-medium text-ink">{order.name}</Td>
                    <Td>{order.vendor.name}</Td>
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

      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-ink-3">
        Billed quantities are tracked per line, so an order can be billed in instalments. A CHECK
        constraint stops the total billed from ever exceeding the quantity ordered.
      </p>
    </>
  );
}

import Link from "next/link";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/app-context";
import { Money } from "@/components/ui/money";
import {
  Badge,
  EmptyState,
  Panel,
  StateBadge,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";

/**
 * Payments Made and Payments Received are the same table read in two
 * directions, so they share one component rather than two near-identical files.
 */
export async function PaymentList({ direction }: { direction: "SEND" | "RECEIVE" }) {
  const payments = await prisma.payment.findMany({
    where: { direction },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    include: {
      partner: { select: { name: true } },
      journal: { select: { name: true } },
      allocations: {
        include: {
          customerInvoice: { select: { id: true, name: true } },
          vendorBill: { select: { id: true, name: true } },
        },
      },
    },
  });

  const total = payments
    .filter((p) => p.state === "CONFIRMED")
    .reduce((s, p) => s + p.amountPaise, 0n);

  if (payments.length === 0) {
    return (
      <Panel>
        <EmptyState
          title={direction === "SEND" ? "No payments made" : "No payments received"}
          hint="Open a posted bill or invoice and use Register Payment."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <Table>
        <thead>
          <tr>
            <Th className="w-40">Number</Th>
            <Th className="w-28">Date</Th>
            <Th>{direction === "SEND" ? "Paid to" : "Received from"}</Th>
            <Th className="w-24">Via</Th>
            <Th>Settles</Th>
            <Th numeric className="w-36">
              Amount
            </Th>
            <Th className="w-24">State</Th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="transition-colors hover:bg-surface-2">
              <Td>
                <Link
                  href={`/payments/${payment.id}`}
                  className="font-medium text-ink hover:text-walnut hover:underline"
                >
                  {payment.state === "DRAFT" ? (
                    <span className="text-ink-3">Draft</span>
                  ) : (
                    payment.name
                  )}
                </Link>
              </Td>
              <Td className="whitespace-nowrap text-ink-3">{formatDate(payment.paymentDate)}</Td>
              <Td className="max-w-[14rem] truncate">{payment.partner.name}</Td>
              <Td>
                <Badge tone="neutral">{payment.method}</Badge>
              </Td>
              <Td className="text-ink-3">
                {payment.allocations.length === 0 ? (
                  <span className="text-ink-4">Unallocated</span>
                ) : (
                  <span className="flex flex-wrap gap-x-2">
                    {payment.allocations.map((allocation) => {
                      const doc = allocation.customerInvoice ?? allocation.vendorBill;
                      const href = allocation.customerInvoice
                        ? `/invoices/${allocation.customerInvoice.id}`
                        : `/bills/${allocation.vendorBill?.id}`;
                      return doc ? (
                        <Link
                          key={allocation.id}
                          href={href}
                          className="text-ink-2 hover:text-walnut hover:underline"
                        >
                          {doc.name}
                        </Link>
                      ) : null;
                    })}
                  </span>
                )}
              </Td>
              <Td numeric className="font-medium">
                <Money paise={payment.amountPaise} />
              </Td>
              <Td>
                <StateBadge state={payment.state} />
              </Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <Td colSpan={5} className="rule-total font-medium text-ink">
              {payments.length} payments &middot; confirmed total
            </Td>
            <Td numeric className="rule-total">
              <Money paise={total} emphasis dashZero={false} />
            </Td>
            <Td className="rule-total" />
          </tr>
        </tfoot>
      </Table>
    </Panel>
  );
}

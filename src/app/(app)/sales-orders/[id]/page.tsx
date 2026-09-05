import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatDate, today, toIsoDate } from "@/lib/app-context";
import { Money, Qty } from "@/components/ui/money";
import {
  Detail,
  Panel,
  PanelHeader,
  StateBadge,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { FormError } from "@/components/ui/form";
import { isDraftPlaceholder } from "@/lib/accounting/sequence";
import { ConfirmOrderButton, CreateInvoiceButton } from "./order-actions";

export const dynamic = "force-dynamic";

export default async function SalesOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: {
        orderBy: { lineNo: "asc" },
        include: {
          product: { select: { name: true } },
          analyticAccount: { select: { name: true } },
          tax: { select: { name: true, rateBp: true } },
        },
      },
      invoices: {
        orderBy: { invoiceDate: "asc" },
        select: { id: true, name: true, invoiceDate: true, state: true, totalPaise: true },
      },
    },
  });

  if (!order) notFound();

  const isDraft = order.state === "DRAFT";
  const displayName = isDraftPlaceholder(order.name) ? "Draft sales order" : order.name;

  // What is still convertible. Drives both the remainder column and whether
  // the Create Invoice action is offered at all.
  const outstanding = order.lines.reduce(
    (sum, line) => sum + (line.quantityMilli - line.qtyInvoicedMilli),
    0n,
  );

  return (
    <>
      <Link
        href="/sales-orders"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Sales orders
      </Link>

      {error ? (
        <div className="mb-4">
          <FormError>{decodeURIComponent(error)}</FormError>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-3">Sales</p>
          <h1 className="flex items-center gap-2.5 text-[19px] font-semibold text-ink-1">
            {displayName}
            <StateBadge state={order.state} />
          </h1>
          <p className="mt-1 max-w-xl text-[12.5px] text-ink-3">
            An order posts nothing. The ledger moves only when a bill created from it is
            confirmed.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isDraft ? <ConfirmOrderButton orderId={order.id} /> : null}
          {!isDraft && outstanding > 0n ? (
            <CreateInvoiceButton orderId={order.id} defaultInvoiceDate={toIsoDate(today())} />
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <Panel className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Customer">{order.customer.name}</Detail>
            <Detail label="Order date">{formatDate(order.orderDate)}</Detail>
            <Detail label="Untaxed"><Money paise={order.untaxedPaise} /></Detail>
            <Detail label="Total"><Money paise={order.totalPaise} /></Detail>
          </div>
          {order.notes ? (
            <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-ink-2">{order.notes}</p>
          ) : null}
        </Panel>

        <Panel>
          <PanelHeader
            title="Lines"
            subtitle={
              isDraft
                ? "Confirm the order to allocate its number and open it for billing"
                : "The remainder column is what a new bill would carry forward"
            }
          />
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Product</Th>
                <Th>Analytic</Th>
                <Th numeric>Ordered</Th>
                <Th numeric>Invoiced</Th>
                <Th numeric>Remaining</Th>
                <Th numeric>Unit price</Th>
                <Th numeric>Subtotal</Th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => {
                const remaining = line.quantityMilli - line.qtyInvoicedMilli;
                return (
                  <tr key={line.id}>
                    <Td className="text-ink-3">{line.lineNo}</Td>
                    <Td>{line.product.name}</Td>
                    <Td className="text-ink-3">{line.analyticAccount?.name ?? "—"}</Td>
                    <Td numeric>
                      <Qty milli={line.quantityMilli} />
                    </Td>
                    <Td numeric className="text-ink-3">
                      <Qty milli={line.qtyInvoicedMilli} />
                    </Td>
                    <Td numeric className={remaining > 0n ? "text-walnut" : "text-ink-3"}>
                      <Qty milli={remaining} />
                    </Td>
                    <Td numeric>
                      <Money paise={line.unitPricePaise} />
                    </Td>
                    <Td numeric>
                      <Money paise={line.subtotalPaise} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>

        {order.invoices.length > 0 ? (
          <Panel>
            <PanelHeader
              title="Invoices from this order"
              subtitle="Each one carried the then-outstanding quantity forward"
            />
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Date</Th>
                  <Th>State</Th>
                  <Th numeric>Total</Th>
                </tr>
              </thead>
              <tbody>
                {order.invoices.map((bill) => (
                  <tr key={bill.id}>
                    <Td>
                      <Link href={`/invoices/${bill.id}`} className="text-walnut hover:underline">
                        {isDraftPlaceholder(bill.name) ? "Draft invoice" : bill.name}
                      </Link>
                    </Td>
                    <Td>{formatDate(bill.invoiceDate)}</Td>
                    <Td>
                      <StateBadge state={bill.state} />
                    </Td>
                    <Td numeric>
                      <Money paise={bill.totalPaise} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        ) : null}
      </div>
    </>
  );
}

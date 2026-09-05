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
export const metadata: Metadata = { title: "Customer Invoices" };

export default async function InvoicesPage() {
  const asOf = today();
  const invoices = await prisma.customerInvoice.findMany({
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    include: { customer: { select: { name: true } } },
  });

  const outstanding = invoices.reduce((s, i) => s + i.residualPaise, 0n);

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Customer Invoices"
        description="What we have billed customers. Confirming an invoice posts Dr Debtors, Cr Sales Income, Cr Output GST — revenue is recognised now, not when the money arrives."
        actions={
          <ButtonLink href="/invoices/new" variant="primary">
            New invoice
          </ButtonLink>
        }
      />

      <Panel>
        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            hint="Bill a customer, then confirm to post the entry."
            action={
              <ButtonLink href="/invoices/new" variant="primary">
                New invoice
              </ButtonLink>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-40">Number</Th>
                <Th>Customer</Th>
                <Th className="w-28">Invoice date</Th>
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
              {invoices.map((invoice) => {
                const overdue = invoice.residualPaise > 0n && invoice.dueDate < asOf;
                const draft = invoice.state === "DRAFT";
                return (
                  <tr key={invoice.id} className="transition-colors hover:bg-surface-2">
                    <Td>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium text-ink hover:text-walnut hover:underline"
                      >
                        {draft ? <span className="text-ink-3">Draft</span> : invoice.name}
                      </Link>
                    </Td>
                    <Td className="max-w-[16rem] truncate">{invoice.customer.name}</Td>
                    <Td className="whitespace-nowrap text-ink-3">
                      {formatDate(invoice.invoiceDate)}
                    </Td>
                    <Td
                      className={
                        overdue
                          ? "whitespace-nowrap font-medium text-oxide"
                          : "whitespace-nowrap text-ink-3"
                      }
                    >
                      {formatDate(invoice.dueDate)}
                    </Td>
                    <Td numeric>
                      <Money paise={invoice.totalPaise} />
                    </Td>
                    <Td numeric className="font-medium">
                      <Money paise={invoice.residualPaise} />
                    </Td>
                    <Td>
                      <StateBadge state={invoice.state} />
                    </Td>
                    <Td>{draft ? null : <PaymentBadge state={invoice.paymentState} />}</Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <Td colSpan={5} className="rule-total font-medium text-ink">
                  {invoices.length} invoices
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

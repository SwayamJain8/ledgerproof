import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

import { prisma } from "@/lib/db";
import { paidByMethod } from "@/lib/accounting/documents";
import { formatDate, today, toIsoDate } from "@/lib/app-context";
import { Money, Qty } from "@/components/ui/money";
import {
  Badge,
  ButtonLink,
  Detail,
  PaymentBadge,
  Panel,
  PanelHeader,
  StageBar,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { FormError } from "@/components/ui/form";
import { RegisterPayment } from "@/components/documents/register-payment";
import { ConfirmInvoiceButton } from "./confirm-button";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const invoice = await prisma.customerInvoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: {
        orderBy: { lineNo: "asc" },
        include: {
          product: { select: { name: true } },
          account: { select: { code: true, name: true } },
          analyticAccount: { select: { name: true } },
          tax: { select: { name: true, rateBp: true } },
        },
      },
      allocations: {
        include: {
          payment: {
            select: { id: true, name: true, method: true, paymentDate: true, state: true },
          },
        },
      },
    },
  });

  if (!invoice) notFound();

  const entry = invoice.journalEntryId
    ? await prisma.journalEntry.findFirst({
        where: { sourceType: "CUSTOMER_INVOICE", sourceId: invoice.id },
      })
    : null;
  const paid = await paidByMethod(prisma, { customerInvoiceId: invoice.id });
  const posted = invoice.state === "POSTED";
  const overdue = invoice.residualPaise > 0n && invoice.dueDate < today();

  return (
    <>
      <Link
        href="/invoices"
        className="no-print mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Customer invoices
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps mb-1.5">Customer invoice</p>
          <h1 className="font-display text-[26px] leading-none text-ink">
            {posted ? invoice.name : "New invoice"}
          </h1>
          <p className="mt-2 text-[13px] text-ink-3">
            {invoice.customer.name}
            {invoice.customer.city ? ` · ${invoice.customer.city}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <StageBar stages={["DRAFT", "POSTED", "CANCELLED"]} current={invoice.state} />
          <div className="flex items-center gap-2">
            {!posted ? <ConfirmInvoiceButton invoiceId={invoice.id} /> : null}
            {entry ? (
              <ButtonLink href={`/journal-entries/${entry.id}`}>
                <FileText className="h-3.5 w-3.5" />
                Journal entry
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <FormError>{error}</FormError>
        </div>
      ) : null}

      {overdue ? (
        <div className="mb-4 rounded-md border border-oxide/25 bg-oxide-2 px-4 py-2.5 text-[13px] text-oxide">
          Overdue since {formatDate(invoice.dueDate)} &mdash;{" "}
          <Money paise={invoice.residualPaise} className="text-oxide" /> still outstanding.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Lines"
              subtitle={
                posted
                  ? "The Account column shows what the posting engine actually resolved"
                  : "Leave Account on Auto to let the engine resolve it at Confirm"
              }
            />
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">#</Th>
                  <Th>Product</Th>
                  <Th>Account</Th>
                  <Th>Analytic</Th>
                  <Th numeric className="w-20">
                    Qty
                  </Th>
                  <Th numeric className="w-32">
                    Unit price
                  </Th>
                  <Th className="w-24">Tax</Th>
                  <Th numeric className="w-32">
                    Subtotal
                  </Th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.id}>
                    <Td className="tnum text-ink-4">{line.lineNo}</Td>
                    <Td className="font-medium text-ink">
                      {line.description ?? line.product.name}
                    </Td>
                    <Td className="text-ink-3">
                      {line.account ? (
                        `${line.account.code} ${line.account.name}`
                      ) : (
                        <span
                          className="text-ink-4 italic"
                          title="Not overridden — the engine walks the resolution chain"
                        >
                          Resolved by engine
                        </span>
                      )}
                    </Td>
                    <Td className="text-ink-3">{line.analyticAccount?.name ?? "\u2014"}</Td>
                    <Td numeric>
                      <Qty milli={line.quantityMilli} />
                    </Td>
                    <Td numeric>
                      <Money paise={line.unitPricePaise} />
                    </Td>
                    <Td className="text-ink-3">{line.tax?.name ?? "\u2014"}</Td>
                    <Td numeric className="font-medium">
                      <Money paise={line.subtotalPaise} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="flex justify-end border-t border-rule px-4 py-3">
              <dl className="w-64 space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-ink-3">Untaxed amount</dt>
                  <dd>
                    <Money paise={invoice.untaxedPaise} dashZero={false} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-3">Tax</dt>
                  <dd>
                    <Money paise={invoice.taxPaise} dashZero={false} />
                  </dd>
                </div>
                <div className="rule-total flex justify-between pt-1.5">
                  <dt className="font-medium text-ink">Total</dt>
                  <dd>
                    <Money paise={invoice.totalPaise} symbol emphasis dashZero={false} />
                  </dd>
                </div>
              </dl>
            </div>
          </Panel>

          {posted && invoice.residualPaise > 0n ? (
            <RegisterPayment
              documentType="INVOICE"
              documentId={invoice.id}
              residualPaise={invoice.residualPaise}
              defaultDate={toIsoDate(today())}
            />
          ) : null}

          {invoice.allocations.length > 0 ? (
            <Panel>
              <PanelHeader title="Payments" subtitle="Each row settles part of this invoice" />
              <Table>
                <thead>
                  <tr>
                    <Th>Payment</Th>
                    <Th className="w-28">Date</Th>
                    <Th className="w-24">Via</Th>
                    <Th numeric className="w-36">
                      Applied
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.allocations.map((allocation) => (
                    <tr key={allocation.id}>
                      <Td>
                        <Link
                          href={`/payments/${allocation.payment.id}`}
                          className="font-medium text-ink hover:text-walnut hover:underline"
                        >
                          {allocation.payment.name}
                        </Link>
                      </Td>
                      <Td className="text-ink-3">{formatDate(allocation.payment.paymentDate)}</Td>
                      <Td>
                        <Badge tone="neutral">{allocation.payment.method}</Badge>
                      </Td>
                      <Td numeric>
                        <Money paise={allocation.amountPaise} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Panel>
            <PanelHeader title="Details" />
            <dl className="grid grid-cols-2 gap-4 px-4 py-4">
              <Detail label="Customer">{invoice.customer.name}</Detail>
              <Detail label="Invoice date">{formatDate(invoice.invoiceDate)}</Detail>
              <Detail label="Due date">{formatDate(invoice.dueDate)}</Detail>
              <Detail label="Reference">{invoice.invoiceReference ?? "\u2014"}</Detail>
            </dl>
          </Panel>

          {posted ? (
            <Panel>
              <PanelHeader title="Settlement" />
              <dl className="space-y-2.5 px-4 py-4 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-ink-3">Invoice total</dt>
                  <dd>
                    <Money paise={invoice.totalPaise} dashZero={false} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-3">Received via bank</dt>
                  <dd>
                    <Money paise={paid.bankPaise} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-3">Received in cash</dt>
                  <dd>
                    <Money paise={paid.cashPaise} />
                  </dd>
                </div>
                <div className="rule-total flex items-center justify-between pt-2">
                  <dt className="font-medium text-ink">Amount due</dt>
                  <dd>
                    <Money paise={invoice.residualPaise} emphasis dashZero={false} />
                  </dd>
                </div>
                <div className="pt-1">
                  <PaymentBadge state={invoice.paymentState} />
                </div>
              </dl>
              <p className="border-t border-rule px-4 py-2.5 text-[11.5px] leading-relaxed text-ink-3">
                Paid when the amount due is zero, Not Paid when it equals the total, Partial in
                between. A database CHECK constraint enforces that rule — the badge cannot lie.
              </p>
            </Panel>
          ) : null}
        </aside>
      </div>
    </>
  );
}

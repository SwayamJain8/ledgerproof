import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/app-context";
import { Money } from "@/components/ui/money";
import {
  Badge,
  ButtonLink,
  Detail,
  Panel,
  PanelHeader,
  StageBar,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      partner: true,
      journal: true,
      allocations: {
        include: {
          customerInvoice: { select: { id: true, name: true, totalPaise: true, residualPaise: true } },
          vendorBill: { select: { id: true, name: true, totalPaise: true, residualPaise: true } },
        },
      },
    },
  });

  if (!payment) notFound();

  const entry = await prisma.journalEntry.findFirst({
    where: { sourceType: "PAYMENT", sourceId: payment.id },
  });

  const allocated = payment.allocations.reduce((s, a) => s + a.amountPaise, 0n);
  const receiving = payment.direction === "RECEIVE";
  const backHref = receiving ? "/payments/receive" : "/payments/send";

  return (
    <>
      <Link
        href={backHref}
        className="no-print mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {receiving ? "Payments received" : "Payments made"}
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps mb-1.5">{receiving ? "Payment received" : "Payment made"}</p>
          <h1 className="font-display text-[26px] leading-none text-ink">{payment.name}</h1>
          <p className="mt-2 text-[13px] text-ink-3">
            {receiving ? "From" : "To"} {payment.partner.name} &middot; via {payment.journal.name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <StageBar stages={["DRAFT", "CONFIRMED", "CANCELLED"]} current={payment.state} />
          {entry ? (
            <ButtonLink href={`/journal-entries/${entry.id}`}>
              <FileText className="h-3.5 w-3.5" />
              Journal entry
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
        <Panel>
          <PanelHeader
            title="Allocated against"
            subtitle="One payment can settle several documents, and one document can take several payments"
          />
          <Table>
            <thead>
              <tr>
                <Th>Document</Th>
                <Th numeric className="w-36">
                  Document total
                </Th>
                <Th numeric className="w-36">
                  Applied here
                </Th>
                <Th numeric className="w-36">
                  Still due
                </Th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((allocation) => {
                const doc = allocation.customerInvoice ?? allocation.vendorBill;
                const href = allocation.customerInvoice
                  ? `/invoices/${allocation.customerInvoice.id}`
                  : `/bills/${allocation.vendorBill?.id}`;
                if (!doc) return null;
                return (
                  <tr key={allocation.id}>
                    <Td>
                      <Link
                        href={href}
                        className="font-medium text-ink hover:text-walnut hover:underline"
                      >
                        {doc.name}
                      </Link>
                    </Td>
                    <Td numeric>
                      <Money paise={doc.totalPaise} />
                    </Td>
                    <Td numeric className="font-medium">
                      <Money paise={allocation.amountPaise} />
                    </Td>
                    <Td numeric>
                      <Money paise={doc.residualPaise} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <Td colSpan={2} className="rule-total font-medium text-ink">
                  Total allocated
                </Td>
                <Td numeric className="rule-total">
                  <Money paise={allocated} emphasis dashZero={false} />
                </Td>
                <Td className="rule-total" />
              </tr>
            </tfoot>
          </Table>

          {allocated !== payment.amountPaise ? (
            <p className="border-t border-rule px-4 py-2.5 text-[12px] text-amber">
              <Money paise={payment.amountPaise - allocated} className="text-amber" /> of this
              payment is not yet allocated to any document.
            </p>
          ) : null}
        </Panel>

        <aside className="space-y-4">
          <Panel>
            <PanelHeader title="Details" />
            <dl className="grid grid-cols-2 gap-4 px-4 py-4">
              <Detail label="Amount">
                <Money paise={payment.amountPaise} symbol emphasis dashZero={false} />
              </Detail>
              <Detail label="Date">{formatDate(payment.paymentDate)}</Detail>
              <Detail label="Direction">
                <Badge tone={receiving ? "paid" : "unpaid"}>
                  {receiving ? "Received" : "Sent"}
                </Badge>
              </Detail>
              <Detail label="Paid via">
                <Badge tone="neutral">{payment.method}</Badge>
              </Detail>
              <Detail label="Journal" className="col-span-2">
                {payment.journal.name}
              </Detail>
              {payment.note ? (
                <Detail label="Note" className="col-span-2">
                  {payment.note}
                </Detail>
              ) : null}
            </dl>
          </Panel>

          <Panel className="p-4">
            <p className="label-caps mb-2">What this posted</p>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              {receiving
                ? "Debit Bank or Cash, credit Debtors. No income account is touched — the revenue was recognised when the invoice posted, and counting it again here would overstate the P&L."
                : "Debit Creditors, credit Bank or Cash. No expense account is touched — the cost was recognised when the bill posted."}
            </p>
          </Panel>
        </aside>
      </div>
    </>
  );
}

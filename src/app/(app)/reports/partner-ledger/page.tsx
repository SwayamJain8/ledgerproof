import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { formatDate, today } from "@/lib/app-context";
import { Money } from "@/components/ui/money";
import { PageHeader, Panel, PanelHeader, Table, Td, Th } from "@/components/ui/primitives";
import { PrintButton } from "@/components/report-frame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner Ledger" };

/** The standard aging ladder. Bucket by how long a document has been overdue. */
const BUCKETS = [
  { label: "Not yet due", min: -Infinity, max: 0 },
  { label: "1–30 days", min: 1, max: 30 },
  { label: "31–60 days", min: 31, max: 60 },
  { label: "61–90 days", min: 61, max: 90 },
  { label: "Over 90 days", min: 91, max: Infinity },
];

const daysBetween = (from: Date, to: Date) =>
  Math.floor((to.getTime() - from.getTime()) / 86_400_000);

function bucketOf(dueDate: Date, asOf: Date) {
  const overdue = daysBetween(dueDate, asOf);
  return BUCKETS.findIndex((b) => overdue >= b.min && overdue <= b.max);
}

interface Row {
  id: string;
  name: string;
  buckets: bigint[];
  total: bigint;
}

function AgingTable({
  title,
  subtitle,
  rows,
  hrefBase,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  hrefBase: string;
}) {
  const totals = BUCKETS.map((_, i) => rows.reduce((s, r) => s + r.buckets[i], 0n));
  const grand = rows.reduce((s, r) => s + r.total, 0n);

  return (
    <Panel>
      <PanelHeader title={title} subtitle={subtitle} />
      <Table>
        <thead>
          <tr>
            <Th>Partner</Th>
            {BUCKETS.map((bucket) => (
              <Th key={bucket.label} numeric className="w-32">
                {bucket.label}
              </Th>
            ))}
            <Th numeric className="w-36">
              Total
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-surface-2">
              <Td>
                <Link
                  href={`${hrefBase}`}
                  className="font-medium text-ink hover:text-walnut hover:underline"
                >
                  {row.name}
                </Link>
              </Td>
              {row.buckets.map((amount, i) => (
                <Td key={i} numeric className={i >= 3 && amount > 0n ? "text-oxide" : ""}>
                  <Money paise={amount} className={i >= 3 && amount > 0n ? "text-oxide" : ""} />
                </Td>
              ))}
              <Td numeric className="font-medium">
                <Money paise={row.total} />
              </Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <Td className="rule-total font-semibold text-ink">Total</Td>
            {totals.map((amount, i) => (
              <Td key={i} numeric className="rule-total">
                <Money paise={amount} />
              </Td>
            ))}
            <Td numeric className="rule-total">
              <Money paise={grand} emphasis dashZero={false} />
            </Td>
          </tr>
        </tfoot>
      </Table>
    </Panel>
  );
}

export default async function PartnerLedgerPage() {
  const asOf = today();

  const [invoices, bills] = await Promise.all([
    prisma.customerInvoice.findMany({
      where: { state: "POSTED", residualPaise: { gt: 0 } },
      include: { customer: { select: { id: true, name: true } } },
    }),
    prisma.vendorBill.findMany({
      where: { state: "POSTED", residualPaise: { gt: 0 } },
      include: { vendor: { select: { id: true, name: true } } },
    }),
  ]);

  const build = (
    docs: { dueDate: Date; residualPaise: bigint; partner: { id: string; name: string } }[],
  ): Row[] => {
    const byPartner = new Map<string, Row>();
    for (const doc of docs) {
      const row = byPartner.get(doc.partner.id) ?? {
        id: doc.partner.id,
        name: doc.partner.name,
        buckets: BUCKETS.map(() => 0n),
        total: 0n,
      };
      row.buckets[bucketOf(doc.dueDate, asOf)] += doc.residualPaise;
      row.total += doc.residualPaise;
      byPartner.set(doc.partner.id, row);
    }
    return [...byPartner.values()].sort((a, b) => (b.total > a.total ? 1 : -1));
  };

  const receivables = build(
    invoices.map((i) => ({
      dueDate: i.dueDate,
      residualPaise: i.residualPaise,
      partner: i.customer,
    })),
  );
  const payables = build(
    bills.map((b) => ({ dueDate: b.dueDate, residualPaise: b.residualPaise, partner: b.vendor })),
  );

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Partner Ledger"
        description={`Who owes us and who we owe, bucketed by how long each document has been overdue as at ${formatDate(asOf)}.`}
        actions={<PrintButton />}
      />

      <div className="space-y-4">
        <AgingTable
          title="Receivables aging"
          subtitle="Open customer invoices. These sum to the Debtors control account."
          rows={receivables}
          hrefBase="/invoices"
        />
        <AgingTable
          title="Payables aging"
          subtitle="Open vendor bills. These sum to the Creditors control account."
          rows={payables}
          hrefBase="/bills"
        />
      </div>
    </>
  );
}

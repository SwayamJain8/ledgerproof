import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { Badge, PageHeader, Panel, Table, Td, Th } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Taxes" };

export default async function TaxesPage() {
  const taxes = await prisma.tax.findMany({
    orderBy: [{ scope: "asc" }, { rateBp: "asc" }],
    include: {
      collectedAccount: { select: { code: true, name: true } },
      paidAccount: { select: { code: true, name: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Taxes"
        description="Rates are stored in basis points as integers, so 18% is 1800 and the arithmetic is exact. Tax is computed and rounded per line, then summed — never computed on the document total."
      />

      <Panel>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th className="w-24">Scope</Th>
              <Th className="w-28">Method</Th>
              <Th numeric className="w-24">
                Rate
              </Th>
              <Th numeric className="w-28">
                Basis points
              </Th>
              <Th className="w-56">Collected to (on sales)</Th>
              <Th className="w-56">Paid to (on purchases)</Th>
            </tr>
          </thead>
          <tbody>
            {taxes.map((tax) => (
              <tr key={tax.id} className="transition-colors hover:bg-surface-2">
                <Td className="font-medium text-ink">{tax.name}</Td>
                <Td>
                  <Badge tone="neutral">{tax.scope}</Badge>
                </Td>
                <Td className="text-ink-3">
                  {tax.computation === "EXCLUSIVE" ? "Added to price" : "Included in price"}
                </Td>
                <Td numeric className="tnum font-medium">
                  {(tax.rateBp / 100).toFixed(tax.rateBp % 100 === 0 ? 0 : 2)}%
                </Td>
                <Td numeric className="tnum text-ink-3">
                  {tax.rateBp}
                </Td>
                <Td className="text-ink-3">
                  {tax.collectedAccount ? (
                    `${tax.collectedAccount.code} ${tax.collectedAccount.name}`
                  ) : (
                    <span className="text-ink-4 italic">Company default</span>
                  )}
                </Td>
                <Td className="text-ink-3">
                  {tax.paidAccount ? (
                    `${tax.paidAccount.code} ${tax.paidAccount.name}`
                  ) : (
                    <span className="text-ink-4 italic">Company default</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-ink-3">
        Output tax on a sale is a <strong>liability</strong> — money held on behalf of the
        government until the return is filed. Input tax on a purchase is an{" "}
        <strong>asset</strong> — money the government owes back. Routing either into an income
        account would still balance, which is exactly why the two accounts are configured
        separately here rather than assumed in code.
      </p>
    </>
  );
}

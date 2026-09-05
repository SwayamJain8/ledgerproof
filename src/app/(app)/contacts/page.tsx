import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { Money } from "@/components/ui/money";
import { Badge, PageHeader, Panel, Table, Td, Th } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contacts" };

const TYPE_TONES = { CUSTOMER: "paid", VENDOR: "partial", BOTH: "posted" } as const;

export default async function ContactsPage() {
  const contacts = await prisma.contact.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      receivableAccount: { select: { code: true, name: true } },
      payableAccount: { select: { code: true, name: true } },
      customerInvoices: { where: { state: "POSTED" }, select: { residualPaise: true } },
      vendorBills: { where: { state: "POSTED" }, select: { residualPaise: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Master data"
        title="Contacts"
        description="Customers and vendors. A contact may carry its own receivable or payable account — rung 1 of resolution chain R4. Leave them blank and the company default applies."
      />

      <Panel>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th className="w-28">Type</Th>
              <Th>Email</Th>
              <Th className="w-36">Mobile</Th>
              <Th className="w-28">City</Th>
              <Th className="w-52">Control account</Th>
              <Th numeric className="w-36">
                Outstanding
              </Th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => {
              const owed = contact.customerInvoices.reduce((s, i) => s + i.residualPaise, 0n);
              const owing = contact.vendorBills.reduce((s, b) => s + b.residualPaise, 0n);
              const control = contact.receivableAccount ?? contact.payableAccount;
              return (
                <tr key={contact.id} className="transition-colors hover:bg-surface-2">
                  <Td className="font-medium text-ink">{contact.name}</Td>
                  <Td>
                    <Badge tone={TYPE_TONES[contact.type as keyof typeof TYPE_TONES] ?? "neutral"}>
                      {contact.type}
                    </Badge>
                  </Td>
                  <Td className="text-ink-3">{contact.email ?? "\u2014"}</Td>
                  <Td className="tnum text-ink-3">{contact.mobile ?? "\u2014"}</Td>
                  <Td className="text-ink-3">{contact.city ?? "\u2014"}</Td>
                  <Td className="text-ink-3">
                    {control ? (
                      `${control.code} ${control.name}`
                    ) : (
                      <span className="text-ink-4 italic">Company default</span>
                    )}
                  </Td>
                  <Td numeric className="font-medium">
                    <Money paise={owed > 0n ? owed : owing} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}

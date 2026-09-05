import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { today, toIsoDate } from "@/lib/app-context";
import { addDays } from "@/lib/accounting/dates";
import { NewBillForm } from "./new-bill-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Vendor Bill" };

export default async function NewBillPage() {
  const [vendors, products, taxes, accounts, analytics] = await Promise.all([
    prisma.contact.findMany({
      where: { active: true, type: { in: ["VENDOR", "BOTH"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        salesPricePaise: true,
        costPaise: true,
        salesTaxId: true,
        purchaseTaxId: true,
      },
    }),
    prisma.tax.findMany({
      where: { active: true, scope: { in: ["PURCHASE", "BOTH"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, rateBp: true },
    }),
    prisma.account.findMany({
      where: { active: true, type: { in: ["EXPENSE", "OTHER_EXPENSE", "ASSET"] } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.analyticAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const now = today();

  return (
    <>
      <Link
        href="/bills"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Vendor bills
      </Link>

      <NewBillForm
        vendors={vendors}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          salesPricePaise: p.salesPricePaise.toString(),
          costPaise: p.costPaise.toString(),
          salesTaxId: p.salesTaxId,
          purchaseTaxId: p.purchaseTaxId,
        }))}
        taxes={taxes}
        accounts={accounts.map((a) => ({ id: a.id, label: `${a.code} \u00b7 ${a.name}` }))}
        analytics={analytics.map((a) => ({ id: a.id, label: a.name }))}
        defaultBillDate={toIsoDate(now)}
        defaultDueDate={toIsoDate(addDays(now, 30))}
      />
    </>
  );
}

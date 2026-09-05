import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { today, toIsoDate } from "@/lib/app-context";
import { NewSalesOrderForm } from "./new-order-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Sales Order" };

export default async function NewSalesOrderPage() {
  const [customers, products, taxes, accounts, analytics] = await Promise.all([
    prisma.contact.findMany({
      where: { active: true, type: { in: ["CUSTOMER", "BOTH"] } },
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
      where: { active: true, scope: { in: ["SALE", "BOTH"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, rateBp: true },
    }),
    prisma.account.findMany({
      where: { active: true, type: { in: ["INCOME", "LIABILITY"] } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.analyticAccount.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <Link
        href="/sales-orders"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Sales orders
      </Link>

      <NewSalesOrderForm
        customers={customers}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          salesPricePaise: p.salesPricePaise.toString(),
          costPaise: p.costPaise.toString(),
          salesTaxId: p.salesTaxId,
          purchaseTaxId: p.purchaseTaxId,
        }))}
        taxes={taxes}
        accounts={accounts.map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }))}
        analytics={analytics.map((a) => ({ id: a.id, label: a.name }))}
        defaultOrderDate={toIsoDate(today())}
      />
    </>
  );
}

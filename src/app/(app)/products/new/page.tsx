import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { NewProductForm } from "./product-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Product" };

export default async function NewProductPage() {
  const [categories, taxes, accounts] = await Promise.all([
    prisma.productCategory.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.tax.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.account.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true },
    }),
  ]);

  const label = (a: { id: string; code: string; name: string }) => ({
    id: a.id,
    label: `${a.code} \u00b7 ${a.name}`,
  });

  return (
    <>
      <Link
        href="/products"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Products
      </Link>

      <NewProductForm
        categories={categories.map((c) => ({ id: c.id, label: c.name }))}
        taxes={taxes.map((t) => ({ id: t.id, label: t.name }))}
        incomeAccounts={accounts.filter((a) => a.type === "INCOME").map(label)}
        expenseAccounts={accounts.filter((a) => a.type === "EXPENSE" || a.type === "OTHER_EXPENSE").map(label)}
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { currentFiscalYear, toIsoDate } from "@/lib/app-context";
import { NewBudgetForm } from "./budget-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Budget" };

export default async function NewBudgetPage() {
  const [analytics, people] = await Promise.all([
    prisma.analyticAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const fy = currentFiscalYear();

  return (
    <>
      <Link
        href="/budgets"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Budgets
      </Link>

      <NewBudgetForm
        analytics={analytics.map((a) => ({ id: a.id, label: `${a.name} (${a.type.toLowerCase()})` }))}
        people={people.map((p) => ({ id: p.id, label: p.name }))}
        defaultStart={toIsoDate(fy.start)}
        defaultEnd={toIsoDate(new Date(Date.UTC(fy.start.getUTCFullYear(), fy.start.getUTCMonth() + 3, 0)))}
      />
    </>
  );
}

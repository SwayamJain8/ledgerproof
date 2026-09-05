import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { today, toIsoDate } from "@/lib/app-context";
import { NewEntryForm } from "./entry-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Journal Entry" };

export default async function NewJournalEntryPage() {
  const [journals, accounts, partners, analytics] = await Promise.all([
    prisma.journal.findMany({ orderBy: { code: "asc" } }),
    prisma.account.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.contact.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
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
        href="/journal-entries"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Journal entries
      </Link>

      <NewEntryForm
        journals={journals.map((j) => ({ id: j.id, label: `${j.code} \u00b7 ${j.name}` }))}
        accounts={accounts.map((a) => ({ id: a.id, label: `${a.code} \u00b7 ${a.name}` }))}
        partners={partners.map((p) => ({ id: p.id, label: p.name }))}
        analytics={analytics.map((a) => ({ id: a.id, label: a.name }))}
        defaultDate={toIsoDate(today())}
      />
    </>
  );
}

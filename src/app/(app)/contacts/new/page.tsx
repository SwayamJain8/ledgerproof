import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { NewContactForm } from "./contact-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Contact" };

export default async function NewContactPage() {
  const accounts = await prisma.account.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, type: true, subtype: true },
  });

  const label = (a: (typeof accounts)[number]) => ({ id: a.id, label: `${a.code} · ${a.name}` });

  return (
    <>
      <Link
        href="/contacts"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Contacts
      </Link>

      <NewContactForm
        receivableAccounts={accounts.filter((a) => a.subtype === "RECEIVABLE").map(label)}
        payableAccounts={accounts.filter((a) => a.subtype === "PAYABLE").map(label)}
      />
    </>
  );
}

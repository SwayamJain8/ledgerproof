import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NewAnalyticForm } from "./analytic-form";

export const metadata: Metadata = { title: "New Analytic Account" };

export default function NewAnalyticPage() {
  return (
    <>
      <Link
        href="/analytics"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-walnut"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Analytic accounts
      </Link>
      <NewAnalyticForm />
    </>
  );
}

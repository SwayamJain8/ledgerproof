import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/primitives";
import { PaymentList } from "@/components/documents/payment-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payments Made" };

export default function PaymentsSendPage() {
  return (
    <>
      <PageHeader
        eyebrow="Purchase"
        title="Payments Made"
        description="Money leaving the business. Each one posts Dr Creditors, Cr Bank or Cash — it settles a debt, it is not an expense. The expense was already recognised when the bill posted."
      />
      <PaymentList direction="SEND" />
    </>
  );
}

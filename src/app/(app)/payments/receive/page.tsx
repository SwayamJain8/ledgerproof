import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/primitives";
import { PaymentList } from "@/components/documents/payment-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payments Received" };

export default function PaymentsReceivePage() {
  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Payments Received"
        description="Money arriving. Each one posts Dr Bank or Cash, Cr Debtors — it clears a receivable and touches no income account, because the revenue was recognised when the invoice posted."
      />
      <PaymentList direction="RECEIVE" />
    </>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma, type Tx } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { accountingDate } from "@/lib/accounting/dates";
import { rupeesToPaise } from "@/lib/money";
import { confirmPayment } from "@/lib/accounting/documents";
import { PostingError } from "@/lib/accounting/errors";

const schema = z.object({
  documentType: z.enum(["INVOICE", "BILL"]),
  documentId: z.string().min(1),
  amount: z.string().min(1),
  paymentDate: z.string().min(1),
  method: z.enum(["BANK", "CASH"]),
  note: z.string().optional(),
});

/**
 * Register a payment against one document.
 *
 * The amount is a DEFAULT, not a lock — the mockup is explicit that the user
 * may pay less than the amount due. Paying less produces a PARTIAL badge and a
 * residual, both derived from the allocation row this creates rather than
 * stored as an opinion.
 */
export async function registerPaymentAction(formData: FormData) {
  const session = await requireSession();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { documentType, documentId, method } = parsed.data;
  const backTo = documentType === "INVOICE" ? `/invoices/${documentId}` : `/bills/${documentId}`;

  const amountPaise = rupeesToPaise(parsed.data.amount);
  if (amountPaise <= 0n) {
    redirect(`${backTo}?error=${encodeURIComponent("Enter an amount greater than zero.")}`);
  }

  const journal = await prisma.journal.findFirstOrThrow({ where: { type: method } });

  const document =
    documentType === "INVOICE"
      ? await prisma.customerInvoice.findUnique({ where: { id: documentId } })
      : await prisma.vendorBill.findUnique({ where: { id: documentId } });

  if (!document || document.state !== "POSTED") {
    redirect(`${backTo}?error=${encodeURIComponent("Only a posted document can be paid.")}`);
  }
  if (amountPaise > document.residualPaise) {
    redirect(
      `${backTo}?error=${encodeURIComponent("That is more than the amount still due on this document.")}`,
    );
  }

  const partnerId =
    documentType === "INVOICE"
      ? (document as { customerId: string }).customerId
      : (document as { vendorId: string }).vendorId;

  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          name: `DRAFT-PAY-${Date.now().toString(36)}`,
          direction: documentType === "INVOICE" ? "RECEIVE" : "SEND",
          partnerId,
          paymentDate: accountingDate(parsed.data.paymentDate),
          method,
          journalId: journal.id,
          amountPaise,
          note: parsed.data.note || null,
        },
      });

      await confirmPayment(
        tx as Tx,
        payment.id,
        [
          {
            customerInvoiceId: documentType === "INVOICE" ? documentId : undefined,
            vendorBillId: documentType === "BILL" ? documentId : undefined,
            amountPaise,
          },
        ],
        session.userId,
      );
    });
  } catch (error) {
    const message =
      error instanceof PostingError ? error.message : "The payment could not be posted.";
    redirect(`${backTo}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(backTo);
  revalidatePath("/payments/send");
  revalidatePath("/payments/receive");
  redirect(backTo);
}

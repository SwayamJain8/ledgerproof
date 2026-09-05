"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma, type Tx } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { accountingDate } from "@/lib/accounting/dates";
import { lineSubtotalPaise, qtyToMilli, rupeesToPaise } from "@/lib/money";
import { confirmVendorBill, documentTotals } from "@/lib/accounting/documents";
import { PostingError } from "@/lib/accounting/errors";

const lineSchema = z.object({
  productId: z.string().min(1),
  description: z.string().default(""),
  accountId: z.string().nullable().default(null),
  analyticAccountId: z.string().nullable().default(null),
  qty: z.string(),
  unitPrice: z.string(),
  taxId: z.string().nullable().default(null),
});

const createSchema = z.object({
  vendorId: z.string().min(1, "Choose a vendor."),
  billReference: z.string().optional(),
  billDate: z.string().min(1),
  dueDate: z.string().min(1),
  lines: z.string(),
});

export interface DocFormState {
  error?: string;
}

/**
 * Create a DRAFT vendor bill.
 *
 * Note what this does NOT do: allocate a number, or write anything to the
 * ledger. A draft is just paperwork. The document number and the journal entry
 * both come into existence at Confirm, in one transaction, which is what makes
 * the numbering gapless.
 */
export async function createBillAction(
  _prev: DocFormState,
  formData: FormData,
): Promise<DocFormState> {
  await requireSession();

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const rawLines = z.array(lineSchema).safeParse(JSON.parse(parsed.data.lines));
  if (!rawLines.success || rawLines.data.length === 0) {
    return { error: "Add at least one line with a product." };
  }

  const billDate = accountingDate(parsed.data.billDate);
  const dueDate = accountingDate(parsed.data.dueDate);
  if (dueDate < billDate) return { error: "The due date cannot be before the bill date." };

  const taxes = await prisma.tax.findMany();
  const rateOf = (id: string | null) => (id ? (taxes.find((t) => t.id === id)?.rateBp ?? null) : null);

  const lines = rawLines.data.map((line, index) => {
    const quantityMilli = qtyToMilli(line.qty || "0");
    const unitPricePaise = rupeesToPaise(line.unitPrice || "0");
    return {
      lineNo: index + 1,
      productId: line.productId,
      description: line.description || null,
      accountId: line.accountId,
      analyticAccountId: line.analyticAccountId,
      quantityMilli,
      unitPricePaise,
      taxId: line.taxId,
      subtotalPaise: lineSubtotalPaise(quantityMilli, unitPricePaise),
    };
  });

  const totals = documentTotals(
    lines.map((l) => ({ subtotalPaise: l.subtotalPaise, taxRateBp: rateOf(l.taxId) })),
  );

  const bill = await prisma.vendorBill.create({
    data: {
      // A placeholder until Confirm allocates the real number.
      name: `DRAFT-BILL-${Date.now().toString(36)}`,
      vendorId: parsed.data.vendorId,
      billReference: parsed.data.billReference || null,
      billDate,
      dueDate,
      untaxedPaise: totals.untaxedPaise,
      taxPaise: totals.taxPaise,
      totalPaise: totals.totalPaise,
      residualPaise: totals.totalPaise,
      paymentState: totals.totalPaise === 0n ? "PAID" : "NOT_PAID",
      lines: { create: lines },
    },
  });

  revalidatePath("/bills");
  redirect(`/bills/${bill.id}`);
}

/**
 * Confirm: allocate the number, post the balanced entry, freeze the document.
 * All of it in one transaction, so a failure burns nothing.
 */
export async function confirmBillAction(formData: FormData) {
  const session = await requireSession();
  const billId = String(formData.get("billId") ?? "");
  if (!billId) return;

  try {
    await prisma.$transaction((tx) => confirmVendorBill(tx as Tx, billId, session.userId));
  } catch (error) {
    const message =
      error instanceof PostingError ? error.message : "The bill could not be posted.";
    redirect(`/bills/${billId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/bills");
  revalidatePath(`/bills/${billId}`);
  redirect(`/bills/${billId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma, type Tx } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { accountingDate } from "@/lib/accounting/dates";
import { lineSubtotalPaise, qtyToMilli, rupeesToPaise } from "@/lib/money";
import { confirmCustomerInvoice, documentTotals } from "@/lib/accounting/documents";
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
  customerId: z.string().min(1, "Choose a customer."),
  invoiceReference: z.string().optional(),
  invoiceDate: z.string().min(1),
  dueDate: z.string().min(1),
  lines: z.string(),
});

export interface DocFormState {
  error?: string;
}

/** Create a DRAFT invoice. No number, no ledger impact — see the bill action. */
export async function createInvoiceAction(
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

  const invoiceDate = accountingDate(parsed.data.invoiceDate);
  const dueDate = accountingDate(parsed.data.dueDate);
  if (invoiceDate.getFullYear() < 2016) {
    return { error: "The due date cannot be before 2016." }
  }
  if (dueDate < invoiceDate) return { error: "The due date cannot be before the invoice date." };

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

  const invoice = await prisma.customerInvoice.create({
    data: {
      name: `DRAFT-INV-${Date.now().toString(36)}`,
      customerId: parsed.data.customerId,
      invoiceReference: parsed.data.invoiceReference || null,
      invoiceDate,
      dueDate,
      untaxedPaise: totals.untaxedPaise,
      taxPaise: totals.taxPaise,
      totalPaise: totals.totalPaise,
      residualPaise: totals.totalPaise,
      paymentState: totals.totalPaise === 0n ? "PAID" : "NOT_PAID",
      lines: { create: lines },
    },
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function confirmInvoiceAction(formData: FormData) {
  const session = await requireSession();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return;

  try {
    await prisma.$transaction((tx) => confirmCustomerInvoice(tx as Tx, invoiceId, session.userId));
  } catch (error) {
    const message =
      error instanceof PostingError ? error.message : "The invoice could not be posted.";
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

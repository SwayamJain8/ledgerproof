"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma, type Tx } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { accountingDate } from "@/lib/accounting/dates";
import { today } from "@/lib/app-context";
import { lineSubtotalPaise, qtyToMilli, rupeesToPaise } from "@/lib/money";
import { documentTotals } from "@/lib/accounting/documents";
import { confirmSalesOrder, createInvoiceFromSalesOrder } from "@/lib/accounting/orders";
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
  orderDate: z.string().min(1),
  notes: z.string().optional(),
  lines: z.string(),
});

export interface OrderFormState {
  error?: string;
}

/** Create a DRAFT sales order. No number, no ledger movement. */
export async function createSalesOrderAction(
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  await requireSession();

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const rawLines = z.array(lineSchema).safeParse(JSON.parse(parsed.data.lines));
  if (!rawLines.success || rawLines.data.length === 0) {
    return { error: "Add at least one line with a product." };
  }

  const taxes = await prisma.tax.findMany();
  const rateOf = (id: string | null) => (id ? (taxes.find((t) => t.id === id)?.rateBp ?? null) : null);

  const lines = rawLines.data.map((line, index) => {
    const quantityMilli = qtyToMilli(line.qty || "0");
    const unitPricePaise = rupeesToPaise(line.unitPrice || "0");
    return {
      lineNo: index + 1,
      productId: line.productId,
      description: line.description || null,
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

  const order = await prisma.salesOrder.create({
    data: {
      name: `DRAFT-SO-${Date.now().toString(36)}`,
      customerId: parsed.data.customerId,
      orderDate: accountingDate(parsed.data.orderDate),
      notes: parsed.data.notes || null,
      ...totals,
      lines: { create: lines },
    },
  });

  revalidatePath("/sales-orders");
  redirect(`/sales-orders/${order.id}`);
}

/** Confirm: allocate "SO0001" and open the order for invoicing. */
export async function confirmSalesOrderAction(formData: FormData) {
  await requireSession();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  try {
    await prisma.$transaction((tx) => confirmSalesOrder(tx as Tx, orderId));
  } catch (error) {
    const message =
      error instanceof PostingError ? error.message : "The order could not be confirmed.";
    redirect(`/sales-orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/sales-orders");
  redirect(`/sales-orders/${orderId}`);
}

/**
 * SO -> draft Customer Invoice. The mockup's words: "Create Invoice from a
 * Sales Order must copy Customer Name, Product, Price and Quantity."
 */
export async function createInvoiceFromOrderAction(formData: FormData) {
  await requireSession();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  const invoiceDateRaw = String(formData.get("invoiceDate") ?? "");
  const reference = String(formData.get("invoiceReference") ?? "").trim();

  let invoiceId: string;
  try {
    const invoice = await prisma.$transaction((tx) =>
      createInvoiceFromSalesOrder(tx as Tx, orderId, {
        invoiceDate: invoiceDateRaw ? accountingDate(invoiceDateRaw) : today(),
        invoiceReference: reference || null,
      }),
    );
    invoiceId = invoice.id;
  } catch (error) {
    const message =
      error instanceof PostingError ? error.message : "The invoice could not be created.";
    redirect(`/sales-orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/sales-orders");
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

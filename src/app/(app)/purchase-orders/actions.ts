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
import { confirmPurchaseOrder, createBillFromPurchaseOrder } from "@/lib/accounting/orders";
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
  orderDate: z.string().min(1),
  notes: z.string().optional(),
  lines: z.string(),
});

export interface OrderFormState {
  error?: string;
}

/**
 * Create a DRAFT purchase order.
 *
 * Like a draft bill, this allocates no number and posts nothing. A purchase
 * order is a commitment; the ledger stays untouched until the resulting bill
 * is confirmed.
 */
export async function createPurchaseOrderAction(
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

  const order = await prisma.purchaseOrder.create({
    data: {
      name: `DRAFT-PO-${Date.now().toString(36)}`,
      vendorId: parsed.data.vendorId,
      orderDate: accountingDate(parsed.data.orderDate),
      notes: parsed.data.notes || null,
      ...totals,
      lines: { create: lines },
    },
  });

  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${order.id}`);
}

/** Confirm: allocate "PO0001" and open the order for billing. */
export async function confirmPurchaseOrderAction(formData: FormData) {
  await requireSession();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  try {
    await prisma.$transaction((tx) => confirmPurchaseOrder(tx as Tx, orderId));
  } catch (error) {
    const message =
      error instanceof PostingError ? error.message : "The order could not be confirmed.";
    redirect(`/purchase-orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${orderId}`);
}

/**
 * PO -> draft Vendor Bill, carrying vendor, product, price and quantity
 * forward. Only the unbilled remainder is copied, so a partially billed order
 * can be billed again for the rest.
 */
export async function createBillFromOrderAction(formData: FormData) {
  await requireSession();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  const billDateRaw = String(formData.get("billDate") ?? "");
  const reference = String(formData.get("billReference") ?? "").trim();

  let billId: string;
  try {
    const bill = await prisma.$transaction((tx) =>
      createBillFromPurchaseOrder(tx as Tx, orderId, {
        billDate: billDateRaw ? accountingDate(billDateRaw) : today(),
        billReference: reference || null,
      }),
    );
    billId = bill.id;
  } catch (error) {
    const message =
      error instanceof PostingError ? error.message : "The bill could not be created.";
    redirect(`/purchase-orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/purchase-orders");
  revalidatePath("/bills");
  redirect(`/bills/${billId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { rupeesToPaise } from "@/lib/money";

const money = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 10000 or 10000.50");

const productSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name."),
  type: z.enum(["GOODS", "SERVICE", "COMBO"]),
  salesPrice: money,
  cost: money,
  categoryId: z.string().optional(),
  salesTaxId: z.string().optional(),
  purchaseTaxId: z.string().optional(),
  incomeAccountId: z.string().optional(),
  expenseAccountId: z.string().optional(),
  trackInventory: z.string().optional(),
});

export interface ProductFormState {
  error?: string;
}

/**
 * Create a product.
 *
 * The income and expense accounts are optional and usually left blank. That is
 * the point of the resolution chain: product first, then its category, then the
 * journal default. Filling one in here is how you override a single product
 * without touching the others.
 */
export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireSession();

  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const d = parsed.data;

  await prisma.product.create({
    data: {
      name: d.name,
      type: d.type,
      salesPricePaise: rupeesToPaise(d.salesPrice),
      costPaise: rupeesToPaise(d.cost),
      categoryId: d.categoryId || null,
      salesTaxId: d.salesTaxId || null,
      purchaseTaxId: d.purchaseTaxId || null,
      incomeAccountId: d.incomeAccountId || null,
      expenseAccountId: d.expenseAccountId || null,
      // A service has nothing to hold in stock.
      trackInventory: d.type !== "SERVICE" && d.trackInventory === "on",
    },
  });

  revalidatePath("/products");
  redirect("/products");
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a category name."),
  incomeAccountId: z.string().optional(),
  expenseAccountId: z.string().optional(),
});

/** Categories are rung 3 of the resolution chain — one account for a whole group. */
export async function createCategoryAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireSession();

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const d = parsed.data;

  const clash = await prisma.productCategory.findFirst({ where: { name: d.name } });
  if (clash) return { error: "A category with that name already exists." };

  await prisma.productCategory.create({
    data: {
      name: d.name,
      incomeAccountId: d.incomeAccountId || null,
      expenseAccountId: d.expenseAccountId || null,
    },
  });

  revalidatePath("/products");
  redirect("/products");
}

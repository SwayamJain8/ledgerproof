"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  code: z.string().trim().max(16, "Keep the code short.").optional(),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export interface AnalyticFormState {
  error?: string;
}

/**
 * Create an analytic account — a project, department or campaign.
 *
 * The type is directional and fixed, per the mockup: an analytic tag on an
 * invoice line counts as INCOME, one on a purchase order or bill line counts as
 * EXPENSE. That is what lets a budget read its actuals straight off the ledger.
 */
export async function createAnalyticAction(
  _prev: AnalyticFormState,
  formData: FormData,
): Promise<AnalyticFormState> {
  await requireSession();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const d = parsed.data;

  const clash = await prisma.analyticAccount.findFirst({ where: { name: d.name } });
  if (clash) return { error: "An analytic account with that name already exists." };

  await prisma.analyticAccount.create({
    data: { name: d.name, code: d.code || null, type: d.type },
  });

  revalidatePath("/analytics");
  redirect("/analytics");
}

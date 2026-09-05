"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

const BACK = "/budgets";

/**
 * BUDGET LIFECYCLE — Draft > Confirmed > Revised, plus Cancel-as-archive.
 *
 * The mockup is unusually specific here, and every rule below is a literal
 * requirement rather than a design choice of ours:
 *
 *   - Revise does NOT edit in place. It COPIES the budget to a new record,
 *     moves the original to Revised, and links the two both ways.
 *   - The revision keeps the original name with " Revised" appended.
 *   - Cancel ARCHIVES (active = false). It never deletes, because a budget
 *     that was reported against last quarter still has to exist.
 */

export async function confirmBudgetAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("budgetId") ?? "");
  if (!id) return;

  const budget = await prisma.budget.findUnique({ where: { id } });
  if (!budget || budget.state !== "DRAFT") {
    redirect(`${BACK}?error=${encodeURIComponent("Only a draft budget can be confirmed.")}`);
  }

  await prisma.budget.update({ where: { id }, data: { state: "CONFIRMED" } });
  revalidatePath(BACK);
  redirect(BACK);
}

/**
 * Revise: copy forward, supersede the original, link both ways.
 *
 * Done in one transaction so a budget can never end up superseded with no
 * successor, which would silently drop it out of every report.
 */
export async function reviseBudgetAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("budgetId") ?? "");
  if (!id) return;

  const original = await prisma.budget.findUnique({
    where: { id },
    include: { lines: true, revisedBy: { select: { id: true } } },
  });

  // The mockup shows Revise only on a Confirmed budget.
  if (!original || original.state !== "CONFIRMED") {
    redirect(`${BACK}?error=${encodeURIComponent("Only a confirmed budget can be revised.")}`);
  }
  if (original.revisedBy) {
    redirect(`${BACK}?error=${encodeURIComponent("That budget has already been revised.")}`);
  }

  // "Project A" -> "Project A Revised", and never "Project A Revised Revised".
  const revisedName = original.name.endsWith(" Revised")
    ? original.name
    : `${original.name} Revised`;

  await prisma.$transaction(async (tx) => {
    await tx.budget.create({
      data: {
        name: revisedName,
        startDate: original.startDate,
        endDate: original.endDate,
        responsibleId: original.responsibleId,
        state: "DRAFT",
        revisionOfId: original.id,
        lines: {
          create: original.lines.map((line) => ({
            analyticAccountId: line.analyticAccountId,
            type: line.type,
            committedPaise: line.committedPaise,
          })),
        },
      },
    });

    await tx.budget.update({ where: { id: original.id }, data: { state: "REVISED" } });
  });

  revalidatePath(BACK);
  redirect(BACK);
}

/** Cancel means archive. Nothing in accounting is deleted. */
export async function cancelBudgetAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("budgetId") ?? "");
  if (!id) return;

  await prisma.budget.update({
    where: { id },
    data: { state: "CANCELLED", active: false },
  });

  revalidatePath(BACK);
  redirect(BACK);
}

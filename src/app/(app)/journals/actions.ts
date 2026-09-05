"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

const schema = z.object({
  journalId: z.string().min(1),
  defaultAccountId: z.string().min(1),
});

/**
 * Repoint a journal's default account.
 *
 * This is rung 4 of resolution chains R1 and R2 — the last stop before the
 * engine gives up. Changing it here and confirming a new document is the
 * demonstration that the posting engine reads configuration rather than
 * containing account names. Existing entries are untouched, because posted
 * entries are immutable; only documents posted *after* the change move.
 */
export async function setJournalDefaultAccount(formData: FormData) {
  await requireSession();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await prisma.journal.update({
    where: { id: parsed.data.journalId },
    data: { defaultAccountId: parsed.data.defaultAccountId },
  });

  revalidatePath("/journals");
}

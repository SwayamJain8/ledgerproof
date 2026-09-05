"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma, type Tx } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { accountingDate } from "@/lib/accounting/dates";
import { rupeesToPaise } from "@/lib/money";
import { postManualLines, reverseEntry } from "@/lib/accounting/posting";
import { allocateDocumentNumber, SEQUENCE_CODES } from "@/lib/accounting/sequence";
import { PostingError } from "@/lib/accounting/errors";

const lineSchema = z.object({
  accountId: z.string().min(1),
  label: z.string().default(""),
  partnerId: z.string().nullable().default(null),
  analyticAccountId: z.string().nullable().default(null),
  debit: z.string().default("0"),
  credit: z.string().default("0"),
});

const schema = z.object({
  journalId: z.string().min(1, "Choose a journal."),
  date: z.string().min(1, "Choose a date."),
  ref: z.string().optional(),
  lines: z.string(),
});

export interface EntryFormState {
  error?: string;
}

/**
 * Post a manual journal entry.
 *
 * This is the screen that proves the architecture. A judge posts
 * `Dr Cash 50,000 / Cr Capital 50,000` here and the Balance Sheet moves — which
 * is impossible in a system that sums its reports off the invoice tables,
 * because there is nowhere for an entry like this to live.
 *
 * There is no draft step: the entry is written already balanced and POSTED, in
 * one transaction, which is also when it is sealed onto the hash chain.
 */
export async function createJournalEntryAction(
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const session = await requireSession();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const rawLines = z.array(lineSchema).safeParse(JSON.parse(parsed.data.lines));
  if (!rawLines.success) return { error: "Something is wrong with the lines." };

  const lines = rawLines.data
    .map((l) => ({
      accountId: l.accountId,
      label: l.label || "Manual entry",
      partnerId: l.partnerId || null,
      analyticAccountId: l.analyticAccountId || null,
      debitPaise: rupeesToPaise(l.debit || "0"),
      creditPaise: rupeesToPaise(l.credit || "0"),
    }))
    // A row with nothing on either side is a row the user started and abandoned.
    .filter((l) => l.debitPaise > 0n || l.creditPaise > 0n);

  if (lines.length < 2) {
    return { error: "An entry needs at least two lines — something given and something received." };
  }

  const twoSided = lines.find((l) => l.debitPaise > 0n && l.creditPaise > 0n);
  if (twoSided) {
    return { error: "A line is either a debit or a credit, never both. Split it into two lines." };
  }

  const debit = lines.reduce((s, l) => s + l.debitPaise, 0n);
  const credit = lines.reduce((s, l) => s + l.creditPaise, 0n);
  if (debit !== credit) {
    const diff = debit > credit ? debit - credit : credit - debit;
    return {
      error: `Debits and credits must match. They differ by Rs. ${(Number(diff) / 100).toFixed(2)}.`,
    };
  }

  const date = accountingDate(parsed.data.date);

  let entryId: string;
  try {
    const entry = await prisma.$transaction(async (tx) => {
      const name = await allocateDocumentNumber(tx as Tx, SEQUENCE_CODES.MANUAL_ENTRY, date);
      return postManualLines(tx as Tx, {
        name,
        journalId: parsed.data.journalId,
        date,
        ref: parsed.data.ref || null,
        lines,
        postedById: session.userId,
      });
    });
    entryId = entry.entryId;
  } catch (error) {
    return {
      error: error instanceof PostingError ? error.message : "The entry could not be posted.",
    };
  }

  revalidatePath("/journal-entries");
  redirect(`/journal-entries/${entryId}`);
}

/**
 * Cancel a posted entry by writing its mirror image.
 *
 * There is deliberately no Edit and no Delete anywhere in this application. In
 * accounting a deleted row is a fraud tool: it removes the evidence along with
 * the mistake. Cancelling instead posts an equal and opposite entry, so both
 * the error and the correction stay in the books forever and the net effect on
 * every report is zero.
 *
 * `journal_item_is_append_only` enforces this at the database level, so even a
 * script that skips this file cannot rewrite a posted row.
 */
export async function reverseEntryAction(formData: FormData) {
  const session = await requireSession();
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return;

  let reversalId: string;
  try {
    const reversal = await prisma.$transaction((tx) =>
      reverseEntry(tx as Tx, entryId, { postedById: session.userId }),
    );
    reversalId = reversal.id;
  } catch (error) {
    const message =
      error instanceof PostingError ? error.message : "That entry could not be cancelled.";
    redirect(`/journal-entries/${entryId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/journal-entries");
  redirect(`/journal-entries/${reversalId}`);
}

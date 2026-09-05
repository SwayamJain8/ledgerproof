"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma, type Tx } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { confirmPayment } from "@/lib/accounting/documents";
import { PostingError } from "@/lib/accounting/errors";
import { parseBankStatementCsv } from "@/lib/reconciliation/csv";
import { matchStatement, type OpenDocument, type StatementLine } from "@/lib/reconciliation/matcher";

const BACK = "/reconcile";

export interface ImportState {
  error?: string;
  imported?: number;
  skipped?: string[];
}

/** Load the open documents the matcher scores against. */
async function openDocuments(): Promise<OpenDocument[]> {
  const [invoices, bills] = await Promise.all([
    prisma.customerInvoice.findMany({
      where: { state: "POSTED", residualPaise: { gt: 0 } },
      include: { customer: { select: { name: true } } },
    }),
    prisma.vendorBill.findMany({
      where: { state: "POSTED", residualPaise: { gt: 0 } },
      include: { vendor: { select: { name: true } } },
    }),
  ]);

  return [
    ...invoices.map((i) => ({
      id: i.id,
      kind: "INVOICE" as const,
      name: i.name,
      partnerName: i.customer.name,
      residualPaise: i.residualPaise,
      date: i.invoiceDate,
    })),
    ...bills.map((b) => ({
      id: b.id,
      kind: "BILL" as const,
      name: b.name,
      partnerName: b.vendor.name,
      residualPaise: b.residualPaise,
      date: b.billDate,
    })),
  ];
}

/** Statement lines still waiting to be settled. */
async function unmatchedLines(): Promise<StatementLine[]> {
  const rows = await prisma.bankStatementLine.findMany({
    where: { state: "UNMATCHED" },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    narration: r.narration,
    amountPaise: r.amountPaise,
  }));
}

/** Score every unmatched line against every open document. */
export async function currentMatches() {
  const [lines, documents] = await Promise.all([unmatchedLines(), openDocuments()]);
  return matchStatement(lines, documents);
}

/**
 * Import a statement. Parsing is strict: a row that cannot be read is reported
 * rather than dropped, because a silently missing row makes the reconciliation
 * total wrong in a way nobody notices.
 */
export async function importStatementAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireSession();

  const pasted = String(formData.get("csv") ?? "").trim();
  const file = formData.get("file");
  let content = pasted;

  if (!content && file instanceof File && file.size > 0) {
    content = await file.text();
  }
  if (!content) return { error: "Paste a statement or choose a CSV file." };

  const { rows, errors } = parseBankStatementCsv(content);
  if (rows.length === 0) {
    return { error: errors[0] ?? "No usable rows found in that file." };
  }

  await prisma.bankStatementLine.createMany({
    data: rows.map((r) => ({
      date: r.date,
      narration: r.narration,
      amountPaise: r.amountPaise,
      state: "UNMATCHED",
    })),
  });

  revalidatePath(BACK);
  return { imported: rows.length, skipped: errors };
}

/**
 * Settle one statement line against one document.
 *
 * Note what this does NOT do: write to the ledger itself. It creates a payment
 * and hands it to confirmPayment -- the same path the manual Register Payment
 * button uses. Reconciliation is a way of FINDING the payment, never a second
 * way of posting one.
 */
async function settle(lineId: string, documentId: string, confidence: number | null) {
  const session = await requireSession();

  const line = await prisma.bankStatementLine.findUnique({ where: { id: lineId } });
  if (!line || line.state !== "UNMATCHED") return;

  const isReceipt = line.amountPaise >= 0n;
  const amountPaise = isReceipt ? line.amountPaise : -line.amountPaise;

  const document = isReceipt
    ? await prisma.customerInvoice.findUnique({ where: { id: documentId } })
    : await prisma.vendorBill.findUnique({ where: { id: documentId } });
  if (!document || document.state !== "POSTED") return;

  // Never allocate more than the document still owes; the surplus stays on the
  // payment as unallocated credit.
  const allocatePaise = amountPaise > document.residualPaise ? document.residualPaise : amountPaise;

  const journal = await prisma.journal.findFirstOrThrow({ where: { type: "BANK" } });
  const partnerId = isReceipt
    ? (document as { customerId: string }).customerId
    : (document as { vendorId: string }).vendorId;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        name: `DRAFT-PAY-${Date.now().toString(36)}-${lineId.slice(-4)}`,
        direction: isReceipt ? "RECEIVE" : "SEND",
        partnerId,
        paymentDate: line.date,
        method: "BANK",
        journalId: journal.id,
        amountPaise,
        note: `Bank statement: ${line.narration}`,
      },
    });

    await confirmPayment(
      tx as Tx,
      payment.id,
      [
        {
          customerInvoiceId: isReceipt ? documentId : undefined,
          vendorBillId: isReceipt ? undefined : documentId,
          amountPaise: allocatePaise,
        },
      ],
      session.userId,
    );

    await tx.bankStatementLine.update({
      where: { id: lineId },
      data: { state: "MATCHED", matchedPaymentId: payment.id, confidence },
    });
  });
}

/** Manual choice from the ranked suggestions. */
export async function matchLineAction(formData: FormData) {
  const lineId = String(formData.get("lineId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  const confidenceRaw = String(formData.get("confidence") ?? "");
  if (!lineId || !documentId) return;

  try {
    await settle(lineId, documentId, confidenceRaw ? Number(confidenceRaw) : null);
  } catch (error) {
    const message = error instanceof PostingError ? error.message : "That line could not be settled.";
    redirect(`${BACK}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(BACK);
  redirect(BACK);
}

/**
 * Settle every line the matcher is confident about, and leave the rest alone.
 *
 * Matching is recomputed between settlements rather than done once up front,
 * because settling a line changes what is still open -- and a stale candidate
 * list is how a reconciler double-pays an invoice.
 */
export async function reconcileAllAction() {
  await requireSession();

  let settled = 0;
  for (let pass = 0; pass < 50; pass += 1) {
    const matches = await currentMatches();
    const next = matches.find((m) => m.autoMatch);
    if (!next || !next.autoMatch) break;
    await settle(next.line.id, next.autoMatch.document.id, next.autoMatch.confidence);
    settled += 1;
  }

  revalidatePath(BACK);
  redirect(`${BACK}?settled=${settled}`);
}

/** Discard imported lines that have not been settled. */
export async function clearStatementAction() {
  await requireSession();
  await prisma.bankStatementLine.deleteMany({ where: { state: "UNMATCHED" } });
  revalidatePath(BACK);
  redirect(BACK);
}

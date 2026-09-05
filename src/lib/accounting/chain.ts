import { createHash } from "node:crypto";

import type { Tx } from "@/lib/db";

/**
 * TAMPER-EVIDENT LEDGER — the hash chain.
 *
 * Append-only triggers stop the application from rewriting a posted entry. They
 * do not stop someone with a database console, and "trust me, nobody has psql"
 * is not an audit control. So every posted entry is sealed with
 *
 *     hash = sha256(prevHash || canonical(entry))
 *
 * which means each entry commits to the entire history before it. Change one
 * debit in row 4 and every hash from 4 onwards stops matching — you cannot
 * quietly edit the middle of the book, because there is nowhere to hide the
 * change.
 *
 * Odoo ships exactly this for fiscal compliance (its "inalterable" ledger), so
 * an Odoo engineer recognises the shape immediately.
 *
 * WHAT IS SEALED: everything that determines what the entry means -- its
 * number, journal, accounting date, reference, partner, source document,
 * totals, and every line's account and amounts, in line order. Anything a
 * fraudster would want to change is inside the hash.
 */

/** Locks the chain tail for the current transaction so two posts cannot claim the same index. */
const CHAIN_LOCK_KEY = 8_242_026;

export interface ChainableLine {
  lineNo: number;
  accountId: string;
  debitPaise: bigint;
  creditPaise: bigint;
}

export interface ChainableEntry {
  name: string;
  journalId: string;
  date: Date;
  ref?: string | null;
  partnerId?: string | null;
  sourceType: string;
  sourceId?: string | null;
  totalDebitPaise: bigint;
  totalCreditPaise: bigint;
  items: ChainableLine[];
}

/**
 * The exact bytes that get hashed.
 *
 * Deliberately a flat, explicit string rather than JSON.stringify: key order in
 * JSON is an implementation detail, and a chain whose verification depends on
 * one is a chain that breaks on a library upgrade.
 */
export function canonicalise(entry: ChainableEntry): string {
  const head = [
    entry.name,
    entry.journalId,
    entry.date.toISOString().slice(0, 10),
    entry.ref ?? "",
    entry.partnerId ?? "",
    entry.sourceType,
    entry.sourceId ?? "",
    entry.totalDebitPaise.toString(),
    entry.totalCreditPaise.toString(),
  ].join("|");

  const lines = [...entry.items]
    .sort((a, b) => a.lineNo - b.lineNo)
    .map((l) => [l.lineNo, l.accountId, l.debitPaise.toString(), l.creditPaise.toString()].join(":"))
    .join(";");

  return `${head}#${lines}`;
}

export function hashEntry(prevHash: string | null, entry: ChainableEntry): string {
  return createHash("sha256")
    .update(prevHash ?? "GENESIS")
    .update(canonicalise(entry))
    .digest("hex");
}

/**
 * Seal a freshly posted entry onto the end of the chain.
 *
 * Must run INSIDE the posting transaction and AFTER the items exist, since the
 * items are part of what is hashed. The advisory lock is transaction-scoped, so
 * it releases on commit or rollback without any cleanup.
 */
export async function sealEntry(tx: Tx, entryId: string): Promise<void> {
  // $executeRaw, not $queryRaw: the lock function returns void, and the driver
  // cannot map a void result set back into JavaScript.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAIN_LOCK_KEY})`;

  const entry = await tx.journalEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { items: { select: { lineNo: true, accountId: true, debitPaise: true, creditPaise: true } } },
  });

  const tail = await tx.journalEntry.findFirst({
    where: { chainIndex: { not: null } },
    orderBy: { chainIndex: "desc" },
    select: { chainIndex: true, hash: true },
  });

  const chainIndex = (tail?.chainIndex ?? 0) + 1;
  const prevHash = tail?.hash ?? null;
  const hash = hashEntry(prevHash, entry);

  await tx.journalEntry.update({
    where: { id: entryId },
    data: { chainIndex, prevHash, hash },
  });
}

export interface ChainVerification {
  checked: number;
  valid: boolean;
  /** The first entry whose hash does not match, if any. */
  brokenAt: {
    chainIndex: number;
    name: string;
    expected: string;
    found: string;
    reason: "HASH_MISMATCH" | "BROKEN_LINK";
  } | null;
  unsealed: number;
}

/**
 * Walk the chain from the beginning and recompute every hash.
 *
 * Returns the FIRST break rather than a list: after one tampered entry every
 * later hash is wrong too, so reporting them all would bury the one that
 * matters.
 */
export async function verifyChain(tx: Tx): Promise<ChainVerification> {
  const entries = await tx.journalEntry.findMany({
    where: { chainIndex: { not: null } },
    orderBy: { chainIndex: "asc" },
    include: { items: { select: { lineNo: true, accountId: true, debitPaise: true, creditPaise: true } } },
  });

  const unsealed = await tx.journalEntry.count({
    where: { state: "POSTED", chainIndex: null },
  });

  let prevHash: string | null = null;

  for (const entry of entries) {
    // The link: this entry must name the previous entry's hash.
    if ((entry.prevHash ?? null) !== prevHash) {
      return {
        checked: entries.length,
        valid: false,
        unsealed,
        brokenAt: {
          chainIndex: entry.chainIndex!,
          name: entry.name,
          expected: prevHash ?? "(start of chain)",
          found: entry.prevHash ?? "(none)",
          reason: "BROKEN_LINK",
        },
      };
    }

    // The seal: recomputing from the row's current contents must reproduce it.
    const recomputed = hashEntry(prevHash, entry);
    if (recomputed !== entry.hash) {
      return {
        checked: entries.length,
        valid: false,
        unsealed,
        brokenAt: {
          chainIndex: entry.chainIndex!,
          name: entry.name,
          expected: recomputed,
          found: entry.hash ?? "(none)",
          reason: "HASH_MISMATCH",
        },
      };
    }

    prevHash = entry.hash;
  }

  return { checked: entries.length, valid: true, unsealed, brokenAt: null };
}

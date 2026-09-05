/**
 * Prove the tamper-evident ledger actually detects tampering.
 *
 * This is the script to run in front of a judge. It edits a posted journal item
 * DIRECTLY IN THE DATABASE, with the application's append-only trigger switched
 * off, then re-verifies the chain and shows exactly which entry broke.
 *
 * It restores the original value afterwards, so the books are left as found.
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { formatINR } from "../src/lib/money";
import { verifyChain } from "../src/lib/accounting/chain";

let failures = 0;
const ok = (l: string, d = "") => console.log(`  \x1b[32mPASS\x1b[0m  ${l}${d ? `  ${d}` : ""}`);
const bad = (l: string, d: string) => {
  failures += 1;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${l}  ${d}`);
};

async function main() {
  console.log("\n\x1b[1m1. The chain as it stands\x1b[0m");
  const before = await verifyChain(prisma);
  if (before.valid) ok("Every seal matches", `${before.checked} entries re-hashed`);
  else bad("Chain is already broken", `at #${before.brokenAt?.chainIndex}`);
  if (before.unsealed === 0) ok("Every posted entry is sealed");
  else bad("Some posted entries carry no hash", String(before.unsealed));

  // Pick a victim in the middle, so we can show that everything AFTER it also
  // stops verifying -- that is the property a plain per-row checksum lacks.
  const victimEntry = await prisma.journalEntry.findFirstOrThrow({
    where: { chainIndex: 4 },
    include: { items: { orderBy: { lineNo: "asc" } } },
  });
  const victim = victimEntry.items[0];
  const original = victim.debitPaise;

  console.log("\n\x1b[1m2. Tamper with it, straight in the database\x1b[0m");
  console.log(`   entry #${victimEntry.chainIndex} ${victimEntry.name}`);
  console.log(`   changing a debit of ${formatINR(original)} to ${formatINR(9999900n)}`);

  // session_replication_role = replica disables user triggers for this session,
  // which is how a determined insider would get past the append-only guard.
  await prisma.$executeRawUnsafe("SET session_replication_role = replica");
  await prisma.$executeRawUnsafe(
    `UPDATE journal_item SET debit_paise = 9999900 WHERE id = '${victim.id}'`,
  );

  const after = await verifyChain(prisma);
  if (!after.valid) {
    ok("The chain now reports itself broken");
    console.log(`         first break: entry #${after.brokenAt?.chainIndex} (${after.brokenAt?.name})`);
    console.log(`         reason:      ${after.brokenAt?.reason}`);
    console.log(`         expected:    ${after.brokenAt?.expected.slice(0, 32)}…`);
    console.log(`         found:       ${after.brokenAt?.found.slice(0, 32)}…`);
  } else {
    bad("Tampering went undetected", "the chain still verifies, which defeats the point");
  }

  if (after.brokenAt?.chainIndex === victimEntry.chainIndex) {
    ok("It names the exact entry that was altered", `#${after.brokenAt.chainIndex}`);
  } else {
    bad("It blamed the wrong entry", `expected #${victimEntry.chainIndex}, got #${after.brokenAt?.chainIndex}`);
  }

  console.log("\n\x1b[1m3. Put it back\x1b[0m");
  await prisma.$executeRawUnsafe(
    `UPDATE journal_item SET debit_paise = ${original} WHERE id = '${victim.id}'`,
  );
  await prisma.$executeRawUnsafe("SET session_replication_role = origin");

  const restored = await verifyChain(prisma);
  if (restored.valid) ok("Chain verifies again", `${restored.checked} entries`);
  else bad("Chain is still broken after restoring", `at #${restored.brokenAt?.chainIndex}`);

  console.log(
    failures === 0
      ? "\n\x1b[32mThe ledger is genuinely tamper-evident.\x1b[0m\n"
      : `\n\x1b[31m${failures} check(s) FAILED.\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
